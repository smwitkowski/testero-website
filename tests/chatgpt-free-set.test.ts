import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import snapshot from "@/lib/chatgpt/free-set.json";
import additionalSnapshots from "@/lib/chatgpt/free-sets.json";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

interface ExportQuestion {
  id: string; exam: string; status: string; review_status: string;
  parent_question_id?: string | null; domain_id: string; stem: string;
}
interface ExportAnswer {
  question_id: string; choice_label: string; choice_text: string;
  is_correct: boolean; explanation_text: string;
}
interface Bank {
  version: number; source: string; exportedAt: string;
  questions: ExportQuestion[]; answers: ExportAnswer[];
  exam_domains: { id: string; code: string }[];
}
interface Domain { domain: string; numerator: number; denominator: number }
const selectorPath = "../scripts/chatgpt/select-free-set.mjs";
const { selectFreeSet, parseBlueprint, apportionDomains }: {
  selectFreeSet: (source: string, blueprint: string) => typeof snapshot;
  parseBlueprint: (blueprint: string) => Domain[];
  apportionDomains: (domains: Domain[], size?: number) => (Domain & { count: number })[];
} = await import(selectorPath);
const blueprint = readFileSync("lib/constants/pmle-blueprint.ts", "utf8");
const quotas = [5, 7, 8, 8, 7, 5];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fixture(): Bank {
  const bank: Bank = { version: 1, source: "local-test-fixture", exportedAt: "2026-10-20T00:00:00.000Z",
    questions: [], answers: [], exam_domains: PMLE_BLUEPRINT.map((d, i) => ({ id: uuid(i + 1), code: d.domainCode })) };
  bank.exam_domains.forEach((domain, index) => {
    for (let n = 1; n <= 10; n++) {
      const id = uuid((index + 1) * 100 + n);
      bank.questions.push({ id, exam: "GCP_PM_ML_ENG", status: "ACTIVE", review_status: "GOOD",
        parent_question_id: null, domain_id: domain.id, stem: `Unit-test fixture ${id}` });
      for (const label of ["A", "B", "C", "D"]) bank.answers.push({ question_id: id, choice_label: label,
        choice_text: `Unit-test option ${label}`, is_correct: label === "B", explanation_text: `Unit-test explanation ${label}` });
    }
  });
  return bank;
}
const select = (bank: Bank) => selectFreeSet(JSON.stringify(bank), blueprint);

// Independent recursive check: never hide disabled manifests behind CHATGPT_EXAMS.
function inspectPublicManifest(value: unknown, pmle = false, path = "") {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const sourceKeys = ["kind", "upstream", "exported_at", "export_sha256", "blueprint_sha256", "selection"];
  const metadata: Record<string, RegExp> = {
    "source.kind": /^local-export$/,
    "source.upstream": /^read-only-database-content-export$/,
    "source.exported_at": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    "source.export_sha256": /^[0-9a-f]{64}$/,
    "source.blueprint_sha256": /^[0-9a-f]{64}$/,
    "source.selection": /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  };
  if (Array.isArray(value)) {
    expect(path).toBe("question_ids");
    expect(value.length).toBeGreaterThan(0);
    expect(new Set(value).size).toBe(value.length);
    if (pmle) expect(value).toHaveLength(40);
    for (const id of value) { expect(typeof id).toBe("string"); expect(id).toMatch(uuidPattern); }
  } else if (typeof value === "object" && value !== null) {
    expect(["", "source"]).toContain(path);
    const keys = Object.keys(value);
    const required = path === "" ? ["version", "source", "question_ids"]
      : sourceKeys.filter(key => pmle || key !== "blueprint_sha256");
    const allowed = path === "" ? required : sourceKeys;
    for (const key of required) expect(keys).toContain(key);
    for (const key of keys) expect(allowed).toContain(key);
    for (const [key, item] of Object.entries(value)) inspectPublicManifest(item, pmle, path ? `${path}.${key}` : key);
  } else if (path === "version") {
    expect(value).toBe(1);
  } else {
    expect(typeof value).toBe("string");
    expect(metadata[path]).toBeDefined();
    expect(value).toMatch(metadata[path]);
    if (path === "source.selection") {
      expect((value as string).length).toBeLessThanOrEqual(100);
      if (pmle) expect(value).toBe("hamilton-40-lexicographic-uuid-v1");
    }
    if (path === "source.exported_at") {
      const timestamp = new Date(value as string);
      expect(Number.isFinite(timestamp.valueOf())).toBe(true);
      expect(timestamp.toISOString()).toBe(value);
    }
  }
}

describe("D-042 fixed ChatGPT free set", () => {
  it("contains exactly 40 unique UUIDs, not question content", () => {
    expect(snapshot.version).toBe(1);
    expect(snapshot.question_ids).toHaveLength(40);
    expect(new Set(snapshot.question_ids).size).toBe(40);
    for (const id of snapshot.question_ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
  it("recursively contains only IDs and bounded provenance in every committed manifest, even disabled sets", () => {
    inspectPublicManifest(snapshot, true);
    inspectPublicManifest(select(fixture()), true);
    expect(typeof additionalSnapshots).toBe("object");
    expect(Array.isArray(additionalSnapshots)).toBe(false);
    for (const [exam, manifest] of Object.entries(additionalSnapshots)) {
      expect(exam).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(exam.length).toBeLessThanOrEqual(100);
      inspectPublicManifest(manifest);
    }
  });
  it("independently rejects missing provenance and nested content in a public additional manifest", () => {
    const valid = { version: 1, question_ids: [uuid(9999)], source: {
      kind: "local-export", upstream: "read-only-database-content-export",
      exported_at: "2026-10-22T00:00:00.000Z", export_sha256: "a".repeat(64), selection: "synthetic-test",
    } };
    expect(() => inspectPublicManifest(valid)).not.toThrow();
    expect(() => inspectPublicManifest({ version: 1, question_ids: valid.question_ids })).toThrow();
    expect(() => inspectPublicManifest({ ...valid, source: { ...valid.source, stem: "synthetic-content" } })).toThrow();
    expect(() => inspectPublicManifest({ ...valid, source: { ...valid.source, selection: { stem: "synthetic-content" } } })).toThrow();
  });
  it("uses exact Hamilton quotas from the canonical blueprint, with blueprint-order ties", () => {
    expect(apportionDomains(parseBlueprint(blueprint)).map(d => d.count)).toEqual(quotas);
    expect(apportionDomains([
      { domain: "FIRST", numerator: 1, denominator: 2 },
      { domain: "SECOND", numerator: 1, denominator: 2 },
    ], 1).map(d => d.count)).toEqual([1, 0]);
    const bank = fixture();
    const selected = select(bank);
    expect(bank.exam_domains.map(d => selected.question_ids.filter(id =>
      bank.questions.find(q => q.id === id)!.domain_id === d.id).length)).toEqual(quotas);
  });
  it("keeps nonsecret source hashes and the exact blueprint version", () => {
    expect(snapshot.source.kind).toBe("local-export");
    expect(snapshot.source.export_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.source.blueprint_sha256).toBe(hash(blueprint));
    expect(Number.isFinite(Date.parse(snapshot.source.exported_at))).toBe(true);
    expect(snapshot.source.selection).toBe("hamilton-40-lexicographic-uuid-v1");
    const raw = JSON.stringify(fixture());
    expect(selectFreeSet(raw, blueprint).source.export_sha256).toBe(hash(raw));
  });
  it("regenerates IDs from synthetic text and exactly reproduces the local export when available", () => {
    const bank = fixture();
    let offset = 0;
    bank.questions = []; bank.answers = [];
    bank.exam_domains.forEach((domain, index) => {
      for (const id of snapshot.question_ids.slice(offset, offset + quotas[index])) {
        bank.questions.push({ id, exam: "GCP_PM_ML_ENG", status: "ACTIVE", review_status: "GOOD",
          parent_question_id: null, stem: `Synthetic fixture ${id}`, domain_id: domain.id });
        bank.answers.push(...["A", "B", "C", "D"].map(label => ({ question_id: id, choice_label: label,
          choice_text: `Synthetic option ${label}`, is_correct: label === "B", explanation_text: `Synthetic explanation ${label}` })));
      }
      offset += quotas[index];
    });
    expect(select(bank).question_ids).toEqual(snapshot.question_ids);
    // CI never needs the ignored full bank; local runs also prove exact source and output bytes.
    if (existsSync(".qa/chatgpt-source.json")) {
      const raw = readFileSync(".qa/chatgpt-source.json", "utf8");
      expect(hash(raw)).toBe(snapshot.source.export_sha256);
      expect(`${JSON.stringify(selectFreeSet(raw, blueprint), null, 2)}\n`).toBe(readFileSync("lib/chatgpt/free-set.json", "utf8"));
    }
  });
  it.each(["2026-10-20 (SENTINEL_PRIVATE_CONTENT)", "2026-02-30T00:00:00.000Z", "2026-10-20"])("rejects noncanonical public timestamp metadata %s", timestamp => {
    const bank = fixture(); bank.exportedAt = timestamp;
    expect(() => select(bank)).toThrow(/content export/);
  });
  it("chooses the lowest UUIDs independent of export row order", () => {
    const bank = fixture();
    const selected = select(bank);
    const reversed = structuredClone(bank);
    reversed.questions.reverse(); reversed.answers.reverse(); reversed.exam_domains.reverse();
    const reordered = select(reversed);
    expect(reordered.question_ids).toEqual(selected.question_ids);
    expect(reordered.source.export_sha256).not.toBe(selected.source.export_sha256);
    expect(selected.question_ids).toEqual(quotas.flatMap((count, i) =>
      Array.from({ length: count }, (_, n) => uuid((i + 1) * 100 + n + 1))));
    expect(select(bank)).toEqual(selected);
  });
  it.each(["price", "prices", "pricing", "checkout", "upsell", "upgrade", "buy", "purchase", "$49", "49 USD", "https://testero.ai/pass", "https://testero.ai/passes?x=y"])("excludes prohibited policy text %s from every content field", term => {
    for (const field of ["stem", "text", "explanation"]) {
      const bank = fixture(); const q = bank.questions[0];
      const answer = bank.answers.find(a => a.question_id === q.id)!;
      if (field === "stem") q.stem = `Unit-test ${term}`;
      if (field === "text") answer.choice_text = `Unit-test ${term}`;
      if (field === "explanation") answer.explanation_text = `Unit-test ${term}`;
      expect(select(bank).question_ids).not.toContain(q.id);
    }
  });
  it("rejects missing parent provenance, malformed identities, duplicate IDs and insufficient supply", () => {
    const missing = fixture(); delete missing.questions[0].parent_question_id;
    expect(() => select(missing)).toThrow(/explicitly include parent_question_id/);
    const duplicate = fixture(); duplicate.questions.push(duplicate.questions[0]);
    expect(() => select(duplicate)).toThrow(/duplicate question UUID/);
    const malformed = fixture(); malformed.questions[0].id = "not-a-uuid";
    expect(() => select(malformed)).toThrow(/question UUID/);
    const short = fixture(); short.questions = short.questions.filter(q => q.domain_id !== short.exam_domains[0].id);
    expect(() => select(short)).toThrow(/Insufficient eligible originals/);
  });
  it.each(["variant", "inactive", "unreviewed", "wrong-exam", "empty-stem", "missing-answer", "bad-label", "multiple-keys", "no-key", "non-boolean-key", "empty-text", "empty-explanation"])("excludes %s before sorting", reason => {
    const bank = fixture(); const q = bank.questions[0];
    const answers = bank.answers.filter(a => a.question_id === q.id);
    switch (reason) {
      case "variant": q.parent_question_id = uuid(9999); break;
      case "inactive": q.status = "RETIRED"; break;
      case "unreviewed": q.review_status = "PENDING"; break;
      case "wrong-exam": q.exam = "OTHER"; break;
      case "empty-stem": q.stem = " "; break;
      case "missing-answer": bank.answers = bank.answers.filter(a => a !== answers[0]); break;
      case "bad-label": answers[0].choice_label = "E"; break;
      case "multiple-keys": answers[0].is_correct = true; break;
      case "no-key": answers[1].is_correct = false; break;
      case "non-boolean-key": Object.assign(answers[0], { is_correct: "false" }); break;
      case "empty-text": answers[0].choice_text = " "; break;
      case "empty-explanation": answers[0].explanation_text = " "; break;
    }
    const selected = select(bank);
    expect(selected.question_ids).toHaveLength(40);
    expect(selected.question_ids).not.toContain(q.id);
    expect(selected.question_ids).toContain(uuid(106));
  });
});
