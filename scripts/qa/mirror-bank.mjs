import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { localStatus, localURL, pages, rest } from "./safety.mjs";
const PROD = "https://qpjsgcdrgnoinnlxzeze.supabase.co";
const columns = {
  questions: "id,exam,domain_id,stem,difficulty,source_ref,status,review_status,created_at,updated_at",
  answers: "id,question_id,choice_label,choice_text,is_correct,explanation_text",
  explanations: "id,question_id,explanation_text,reasoning_style,doc_links",
  exam_domains: "id,code,name,description",
};
export function validateBank(bank) {
  if (bank.version !== 1 || bank.source !== PROD || !Object.keys(columns).every(table => Array.isArray(bank[table]))) throw new Error("Invalid mirror cache");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const table of Object.keys(columns)) for (const row of bank[table]) if (!uuid.test(row.id) || (row.question_id && !uuid.test(row.question_id)) || (row.domain_id && !uuid.test(row.domain_id))) throw new Error("Invalid content identity");
  const ids = new Set(bank.questions.map(q => q.id));
  const domains = new Set(bank.exam_domains.map(d => d.id));
  if (!ids.size || bank.questions.some(q => q.status !== "ACTIVE" || !domains.has(q.domain_id)) || [...bank.answers, ...bank.explanations].some(row => !ids.has(row.question_id))) throw new Error("Mirror contains non-active or unrelated content");
  for (const [table, select] of Object.entries(columns)) for (const row of bank[table]) if (Object.keys(row).some(key => !select.split(",").includes(key))) throw new Error("Unexpected cache columns");
  return bank;
}
export function assertEligibleSupply(bank) {
  const codes = ["ARCHITECTING_LOW_CODE_ML_SOLUTIONS", "COLLABORATING_TO_MANAGE_DATA_AND_MODELS", "SCALING_PROTOTYPES_INTO_ML_MODELS", "SERVING_AND_SCALING_MODELS", "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES", "MONITORING_ML_SOLUTIONS"];
  for (const code of codes) {
    const domain = bank.exam_domains.find(row => row.code === code);
    const eligible = bank.questions.filter(q => q.domain_id === domain?.id && q.exam === "GCP_PM_ML_ENG" && q.review_status === "GOOD").filter(q => {
      const answers = bank.answers.filter(row => row.question_id === q.id);
      return answers.length === 4 && new Set(answers.map(a => a.choice_label)).size === 4 && answers.filter(a => a.is_correct).length === 1 && answers.every(a => a.choice_text?.trim() && a.explanation_text?.trim()) && bank.explanations.some(e => e.question_id === q.id && e.explanation_text?.trim());
    });
    if (eligible.length < 5) throw new Error(`Insufficient eligible QA content in ${code}`);
  }
}
export function remapDomains(bank, localDomains) {
  const ids = new Map(bank.exam_domains.map(domain => [domain.id, localDomains.find(local => local.code === domain.code)?.id ?? domain.id]));
  return { ...bank, exam_domains: bank.exam_domains.map(domain => ({ ...domain, id: ids.get(domain.id) })), questions: bank.questions.map(question => ({ ...question, domain_id: ids.get(question.domain_id) })) };
}
export async function mirrorBank(refresh = false) {
  const status = await localStatus();
  let bank;
  try { if (!refresh) bank = validateBank(JSON.parse(await readFile(".qa/bank.json", "utf8"))); } catch { /* No valid cache: fetch only allowlisted production content. */ }
  if (!bank) {
    let key;
    try { key = (await promisify(execFile)("gcloud", ["secrets", "versions", "access", "1", "--secret", "testero-supabase-service-role", "--project", "testero-ai"], { maxBuffer: 65536 })).stdout.trim(); }
    catch { throw new Error("Production mirror credential unavailable; check gcloud permission."); }
    bank = { version: 1, source: PROD, exportedAt: new Date().toISOString() };
    bank.questions = await pages(PROD, key, "questions", `select=${columns.questions}&status=eq.ACTIVE`);
    bank.answers = []; bank.explanations = [];
    for (let i = 0; i < bank.questions.length; i += 40) {
      const ids = bank.questions.slice(i, i + 40).map(q => q.id).join(",");
      for (const table of ["answers", "explanations"]) bank[table].push(...await pages(PROD, key, table, `select=${columns[table]}&question_id=in.(${ids})`));
    }
    bank.exam_domains = [];
    const ids = [...new Set(bank.questions.map(q => q.domain_id))];
    for (let i = 0; i < ids.length; i += 40) bank.exam_domains.push(...await pages(PROD, key, "exam_domains", `select=${columns.exam_domains}&id=in.(${ids.slice(i, i + 40).join(",")})`));
    key = undefined;
    validateBank(bank);
    await mkdir(".qa", { recursive: true, mode: 0o700 });
    await writeFile(".qa/bank.json", JSON.stringify(bank), { mode: 0o600 });
  }
  assertEligibleSupply(bank);
  // Reuse local domain identities when the fresh seed has the same unique code.
  const localDomains = await pages(status.API_URL, status.SERVICE_ROLE_KEY, "exam_domains", "select=id,code");
  bank = remapDomains(bank, localDomains);
  localURL(status.API_URL);
  for (const table of ["exam_domains", "questions", "answers", "explanations"]) for (let i = 0; i < bank[table].length; i += 100) await rest(status.API_URL, status.SERVICE_ROLE_KEY, table, table === "explanations" ? "on_conflict=question_id" : "on_conflict=id", bank[table].slice(i, i + 100));
  // Remove stale child rows only for mirrored questions; snapshots are independent.
  for (const table of ["answers", "explanations"]) {
    const expected = new Set(bank[table].map(row => row.id));
    for (let i = 0; i < bank.questions.length; i += 40) {
      const ids = bank.questions.slice(i, i + 40).map(row => row.id).join(",");
      const children = await pages(status.API_URL, status.SERVICE_ROLE_KEY, table, `select=id&question_id=in.(${ids})`);
      for (const row of children.filter(row => !expected.has(row.id))) {
        const response = await fetch(`${status.API_URL}/rest/v1/${table}?id=eq.${row.id}`, { method: "DELETE", redirect: "error", headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` } });
        if (!response.ok) throw new Error("Local child reconciliation failed");
      }
    }
  }
  // Retire absent content only after successful import, preserving old snapshots.
  const exported = new Set(bank.questions.map(row => row.id));
  const local = await pages(status.API_URL, status.SERVICE_ROLE_KEY, "questions", "select=id&status=eq.ACTIVE");
  for (const row of local.filter(row => !exported.has(row.id))) {
    const response = await fetch(`${status.API_URL}/rest/v1/questions?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", redirect: "error", headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "RETIRED" }) });
    if (!response.ok) throw new Error("Local bank reconciliation failed");
  }
  const final = await pages(status.API_URL, status.SERVICE_ROLE_KEY, "questions", "select=id&status=eq.ACTIVE");
  if (final.length !== exported.size || final.some(row => !exported.has(row.id))) throw new Error("Local active inventory differs from mirror");
  console.log(`Local mirror imported: ${bank.questions.length} ACTIVE questions; no production accounts or billing exported.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) mirrorBank(process.argv.includes("--refresh")).catch(() => { console.error("Mirror failed. Check local schema, cache, or gcloud permission; no remote writes attempted."); process.exitCode = 1; });
