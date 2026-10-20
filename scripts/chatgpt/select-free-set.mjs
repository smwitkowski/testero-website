#!/usr/bin/env node
// Offline only: no network, credentials, environment loading, or database calls.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LABELS = ["A", "B", "C", "D"];
const hash = text => createHash("sha256").update(text).digest("hex");
const textPresent = value => typeof value === "string" && value.trim().length > 0;
// D-042 requires literal policy-safe tool text, even for cloud-cost context.
const POLICY_TERMS = /\b(?:prices?|pricing|checkout|upsell|upgrade|buy|purchase|USD)\b|\$\s*\d|\/pass(?:es)?(?:[/?#\s]|$)/i;
const policySafe = value => textPresent(value) && !POLICY_TERMS.test(value);

export function parseBlueprint(text) {
  const block = text.match(/export const PMLE_BLUEPRINT: PmleDomainConfig\[\] = \[([\s\S]*?)\n\];/)?.[1];
  if (!block) throw new Error("Cannot read PMLE_BLUEPRINT configuration");
  const domains = [...block.matchAll(/domainCode:\s*"([A-Z_]+)"[\s\S]*?weight:\s*(\d+)\s*\/\s*(\d+)/g)]
    .map(match => ({ domain: match[1], numerator: Number(match[2]), denominator: Number(match[3]) }));
  if (domains.length !== 6 || new Set(domains.map(d => d.domain)).size !== 6 ||
      domains.some(d => !Number.isSafeInteger(d.numerator) || d.numerator <= 0 || d.denominator !== domains[0].denominator) ||
      domains.reduce((sum, d) => sum + d.numerator, 0) !== domains[0].denominator) {
    throw new Error("Expected six normalized integer-ratio blueprint weights");
  }
  return domains;
}

export function apportionDomains(domains, size = 40) {
  const quotas = domains.map((d, index) => ({ ...d, index,
    count: Math.floor(size * d.numerator / d.denominator),
    remainder: (size * d.numerator) % d.denominator,
  }));
  const extra = size - quotas.reduce((sum, d) => sum + d.count, 0);
  const ranked = [...quotas].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const domain of ranked.slice(0, extra)) domain.count += 1;
  return quotas;
}

export function selectFreeSet(exportText, blueprintText) {
  const bank = JSON.parse(exportText);
  if (bank.version !== 1 || ![bank.questions, bank.answers, bank.exam_domains].every(Array.isArray) ||
      !textPresent(bank.exportedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(bank.exportedAt) ||
      !Number.isFinite(Date.parse(bank.exportedAt)) || new Date(bank.exportedAt).toISOString() !== bank.exportedAt) {
    throw new Error("Expected version 1 content export with exportedAt, questions, answers, and exam_domains");
  }
  // Never infer original provenance from a missing field (including old mirror caches).
  if (bank.questions.some(q => !Object.hasOwn(q, "parent_question_id"))) {
    throw new Error("Every exported question must explicitly include parent_question_id");
  }
  const ids = new Set();
  for (const q of bank.questions) {
    if (!UUID.test(q.id) || ids.has(q.id)) throw new Error("Invalid or duplicate question UUID");
    ids.add(q.id);
  }
  const domains = new Map();
  for (const domain of bank.exam_domains) {
    if (!UUID.test(domain.id) || domains.has(domain.id)) throw new Error("Invalid or duplicate domain UUID");
    domains.set(domain.id, domain.code);
  }
  const answers = new Map();
  for (const answer of bank.answers) {
    if (!answers.has(answer.question_id)) answers.set(answer.question_id, []);
    answers.get(answer.question_id).push(answer);
  }
  const quotas = apportionDomains(parseBlueprint(blueprintText));
  // Public repository artifact: retain IDs only, never source question content.
  const question_ids = [];
  for (const quota of quotas) {
    const eligible = bank.questions.filter(q => {
      if (q.exam !== "GCP_PM_ML_ENG" || q.status !== "ACTIVE" || q.review_status !== "GOOD" ||
          q.parent_question_id !== null || domains.get(q.domain_id) !== quota.domain || !policySafe(q.stem)) return false;
      const options = answers.get(q.id) ?? [];
      return options.length === 4 && new Set(options.map(a => a.choice_label)).size === 4 &&
        options.every(a => LABELS.includes(a.choice_label) && policySafe(a.choice_text) &&
          typeof a.is_correct === "boolean" && policySafe(a.explanation_text)) &&
        options.filter(a => a.is_correct === true).length === 1;
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (eligible.length < quota.count) {
      throw new Error(`Insufficient eligible originals in ${quota.domain}: need ${quota.count}, found ${eligible.length}`);
    }
    question_ids.push(...eligible.slice(0, quota.count).map(q => q.id));
  }
  return { version: 1, source: {
    kind: "local-export",
    upstream: "read-only-database-content-export",
    exported_at: bank.exportedAt,
    export_sha256: hash(exportText),
    blueprint_sha256: hash(blueprintText),
    selection: "hamilton-40-lexicographic-uuid-v1",
  }, question_ids };
}

export async function main(args = process.argv.slice(2)) {
  const flags = new Map();
  let check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check" && !check) { check = true; continue; }
    if (!["--input", "--output"].includes(args[i]) || flags.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("Usage: node scripts/chatgpt/select-free-set.mjs [--input local-export.json] [--output snapshot.json] [--check]");
    }
    flags.set(args[i], args[++i]);
  }
  const input = resolve(ROOT, flags.get("--input") ?? ".qa/chatgpt-source.json");
  const output = resolve(ROOT, flags.get("--output") ?? "lib/chatgpt/free-set.json");
  if (input === output) throw new Error("Input and snapshot output must differ");
  const [source, blueprint] = await Promise.all([
    readFile(input, "utf8"), readFile(resolve(ROOT, "lib/constants/pmle-blueprint.ts"), "utf8"),
  ]);
  const snapshot = selectFreeSet(source, blueprint);
  const encoded = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (check) {
    if (await readFile(output, "utf8") !== encoded) throw new Error("Snapshot differs; review the local source and regenerate");
  } else {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, encoded);
  }
  console.log(`${check ? "Verified" : "Selected"} ${snapshot.question_ids.length} eligible original PMLE question IDs`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
