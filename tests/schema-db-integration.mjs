/** Local SQL integration verifier. Run: DATABASE_URL=<local URL> node tests/schema-db-integration.mjs
 * Requires psql on PATH. Never loads an env file or uses a hosted service.
 * Adds isolated test owners and removes their rows in finally; no real users/keys.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { verifyBetaDiagnostics } from "./helpers/beta-diagnostics-db.mjs";

const prodSchema = process.env.TESTERO_PROD_SCHEMA === "1";
if (process.env.TESTERO_PROD_SCHEMA && !prodSchema) throw new Error("TESTERO_PROD_SCHEMA must be 1 or unset");
if (prodSchema) {
  if (!/project_id\s*=\s*"testero-v2"/.test(readFileSync("supabase/config.toml", "utf8"))) throw new Error("Expected isolated testero-v2 project");
  if (readdirSync(".").some(name => name.startsWith(".env") && name !== ".env.example")) throw new Error("Prod-schema verifier refuses credential env files");
}

const urlText = process.env.DATABASE_URL;
if (!urlText) throw new Error("Provide a LOCAL DATABASE_URL explicitly");
const url = new URL(urlText);
if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || url.port !== "56542" || url.search || url.pathname !== "/postgres") {
  throw new Error("Only loopback PostgreSQL port56542/database postgres is permitted; no URL query overrides");
}
const env = { ...process.env, PGHOST: url.hostname.replace(/[\[\]]/g, ""), PGPORT: url.port,
  PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "disable" };
// Defeat environment-based service/host overrides; never invoke a shell.
for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGOPTIONS", "PGPASSFILE"]) delete env[key];
function run(sql, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", (part) => { output += part; });
    child.stderr.on("data", (part) => { error += part; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !allowFailure) reject(new Error(`Local SQL failed: ${error}`));
      else resolve({ code, output: output.trim(), error });
    });
    child.stdin.end(sql);
  });
}
// Keep a real row-lock transaction open while a second psql connection queues.
// Native test timers model elapsed exam time; this never touches DB lifecycle.
async function openRowLock(sql) {
  const ready = new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "", settled = false;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Local row-lock fixture did not become ready")); }, 5_000);
    const completed = new Promise((finish, fail) => {
      child.on("error", fail);
      child.on("close", code => code === 0 ? finish() : fail(new Error(`Local lock transaction failed: ${error}`)));
    });
    child.stdout.on("data", part => {
      output += part;
      if (!settled && output.includes("TESTERO_MOCK_LOCK_READY")) {
        settled = true; clearTimeout(timeout);
        resolve({ release: () => { child.stdin.end("COMMIT;\n"); }, completed });
      }
    });
    child.stderr.on("data", part => { error += part; });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => { if (!settled) { clearTimeout(timeout); reject(new Error(`Local row-lock fixture exited ${code}: ${error}`)); } });
    // Attach a rejection handler before exposing completed to avoid an unhandled
    // rejection if psql fails before it emits the ready marker.
    completed.catch(() => {});
    child.stdin.write(`BEGIN; ${sql}; SELECT 'TESTERO_MOCK_LOCK_READY';\n`);
  });
  return ready;
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const q = (text) => "'" + String(text).replaceAll("'", "''") + "'";
const scalar = async (sql) => (await run(sql)).output;
const service = (sql) => "BEGIN; SET LOCAL ROLE service_role; " + sql + "; COMMIT;";
async function denied(sql, reason) {
  const result = await run(sql, true);
  assert.notEqual(result.code, 0, reason);
}
const tables = ["exam_domains", "questions", "answers", "explanations", "question_generation_runs",
  "user_subscriptions", "payment_history", "webhook_events", "pmle_passes", "pmle_pass_refunds",
  "study_sessions", "session_items", "free_practice_quota", "mock_exam_sessions", "mock_exam_items"];
const digestSQL = tables.map((table) => `SELECT '${table}', count(*), md5(coalesce(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text), '')) FROM public.${table} t;`).join("\n");
const baseline = readFileSync("supabase/migrations/20261003000000_v2_baseline.sql", "utf8");
const bankTables = tables.slice(0, 5);
const bankDigestSQL = bankTables.map((table) => `SELECT '${table}', count(*), md5(coalesce(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text), '')) FROM public.${table} t;`).join("\n");
const bankBefore = prodSchema ? await scalar(bankDigestSQL) : null;
const before = await scalar(digestSQL);
// Replay the historical baseline in its original RPC namespace. The beta migration
// replaces those signatures with defaulted p_exam arguments; leaving them present
// makes baseline alias definitions ambiguous while both generations coexist.
// Drop only the replacement RPCs inside this rollback-only replay transaction.
// ROLLBACK restores the deployed beta functions and their ACLs after the check.
const baselineReplay = baseline.replace(/^BEGIN;/m, `BEGIN;
  DROP FUNCTION public.create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, TEXT);
  DROP FUNCTION public.create_free_practice_session(UUID, JSONB, TIMESTAMPTZ);
  DROP FUNCTION public.v2_create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, TEXT);
`).replace(/COMMIT;\s*$/, "ROLLBACK;");
await run(baselineReplay);
assert.equal(await scalar(digestSQL), before, "second baseline apply must not change any rows");
if (prodSchema) {
  // No seed read or execution in restored-bank mode. The approved restore stays immutable.
  assert.equal(await scalar("SELECT count(*) FROM public.questions;"), "343");
  assert.equal(await scalar("SELECT count(*) FROM public.questions WHERE status='ACTIVE';"), "145");
  assert.equal(await scalar("SELECT count(*) FROM public.exam_domains;"), "38");
  assert.equal(await scalar("SELECT count(*) FROM public.answers;"), "1372");
  assert.equal(await scalar("SELECT count(*) FROM public.explanations;"), "343");
  assert.equal(await scalar("SELECT count(*) FROM public.question_generation_runs;"), "165");
  assert.equal(await scalar("SELECT count(*) FROM public.questions WHERE source_ref LIKE 'local-educational-seed-%';"), "0");
  const quotas = { ARCHITECTING_LOW_CODE_ML_SOLUTIONS: 2, COLLABORATING_TO_MANAGE_DATA_AND_MODELS: 3,
    SCALING_PROTOTYPES_INTO_ML_MODELS: 4, SERVING_AND_SCALING_MODELS: 4,
    AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES: 4, MONITORING_ML_SOLUTIONS: 3 };
  for (const [code, quota] of Object.entries(quotas)) {
    const available = Number(await scalar(`SELECT count(*) FROM public.questions q JOIN public.exam_domains d ON d.id=q.domain_id
      WHERE q.status='ACTIVE' AND q.review_status='GOOD' AND q.exam='GCP_PM_ML_ENG' AND d.code=${q(code)}
      AND (SELECT count(*)=4 AND count(*) FILTER (WHERE a.is_correct)=1 AND bool_and(length(trim(a.choice_text))>0 AND length(trim(a.explanation_text))>0)
        FROM public.answers a WHERE a.question_id=q.id);`));
    assert.ok(available >= Math.max(5, quota), `${code}: restored bank supplies diagnostic quota ${quota} and five-question practice`);
  }
} else {
  const seed = readFileSync("supabase/seed.sql", "utf8");
  await run(seed);
  const seeded = await scalar(digestSQL);
  await run(seed);
  assert.equal(await scalar(digestSQL), seeded, "second seed apply must preserve rows");
  assert.equal(await scalar("SELECT count(*) FROM public.questions WHERE source_ref LIKE 'local-educational-seed-%';"), "30");
  assert.equal(await scalar("SELECT count(*) FROM (SELECT q.id FROM public.questions q JOIN public.answers a ON a.question_id=q.id WHERE q.source_ref LIKE 'local-educational-seed-%' GROUP BY q.id HAVING count(*)=4 AND count(*) FILTER (WHERE a.is_correct)=1 AND bool_and(length(a.explanation_text)>0)) s;"), "30");
  assert.equal(await scalar("SELECT count(*) FROM (SELECT domain_id FROM public.questions WHERE source_ref LIKE 'local-educational-seed-%' GROUP BY domain_id HAVING count(*)=5) s;"), "6");
}
assert.equal(await scalar(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY[${tables.map(q).join(",")}]) AND c.relrowsecurity;`), String(tables.length));
for (const role of ["anon", "authenticated"]) {
  for (const table of ["questions", "answers", "explanations", "session_items", "webhook_events", "pmle_pass_refunds", "mock_exam_sessions", "mock_exam_items"]) {
    await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.${table}; ROLLBACK;`, `${role} must not read ${table}`);
  }
  for (const signature of ["create_study_session(text,uuid,text,jsonb,timestamptz,text)", "answer_study_item(uuid,uuid,text,uuid,text)", "consume_free_practice_quota(uuid,integer)", "fulfill_pmle_pass(uuid,text,text,text,timestamptz)", "refund_pmle_pass(text,timestamptz)", "record_pmle_pass_payment(text,integer,text)", "v2_consume_free_practice_quota(uuid,integer)", "v2_create_study_session(text,uuid,text,jsonb,timestamptz,boolean,text)", "create_free_practice_session(uuid,jsonb,timestamptz)", "claim_anonymous_diagnostics(uuid,text)", "require_mock_paid_access(uuid)", "create_mock_exam(uuid,jsonb,text)", "interact_mock_exam(uuid,uuid,text,uuid,text)", "create_pass_practice_session(uuid,jsonb,timestamptz)"]) {
    assert.equal(await scalar(`SELECT has_function_privilege('${role}', 'public.${signature}', 'EXECUTE');`), "f");
  }
}
// A restored SECURITY DEFINER legacy writer must not bypass canonical-bank isolation.
// Explicit rollback also protects the bank if the privilege regression unexpectedly succeeds.
if (await scalar("SELECT to_regprocedure('public.upsert_question_answers(uuid,jsonb)') IS NOT NULL;") === "t") {
  const legacyBefore = await scalar(bankDigestSQL);
  const existingId = await scalar("SELECT id FROM public.questions ORDER BY id LIMIT 1;");
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await scalar(`SELECT has_function_privilege('${role}', 'public.upsert_question_answers(uuid,jsonb)', 'EXECUTE');`), "f");
    const deniedWriter = await run(`\\set VERBOSITY verbose
      BEGIN; SET LOCAL ROLE ${role}; SELECT public.upsert_question_answers(${q(existingId)}::uuid,'[]'::jsonb); ROLLBACK;`, true);
    assert.notEqual(deniedWriter.code, 0, `${role}: restored legacy writer denied`);
    assert.match(deniedWriter.error, /42501/, `${role}: writer denial must be insufficient_privilege`);
    assert.equal(await scalar(bankDigestSQL), legacyBefore, `${role}: denied legacy writer leaves all five bank tables unchanged`);
  }
}
console.log(`PASS replay, ${prodSchema ? "restored 145-ACTIVE bank inventory and blueprint supply" : "seed inventory"}, table RLS and browser privilege denial`);
// Multi-cert foundation: transaction-only fixtures never enter the live PMLE pool.
for (const [exam, count] of [["cloud-engineer", 4], ["cloud-architect", 6], ["data-engineer", 5], ["generative-ai-leader", 4], ["agentic-architect", 5]]) {
  assert.equal(await scalar(`SELECT count(*) FROM public.exam_domains WHERE exam=${q(exam)};`), String(count));
}
assert.equal(await scalar("SELECT count(*) FROM public.questions WHERE exam='GCP_PM_ML_ENG' AND question_type <> 'single_select';"), "0");
const certDomain = randomUUID(), certQuestion = randomUUID();
const pmleDomain = await scalar("SELECT id FROM public.exam_domains WHERE exam='GCP_PM_ML_ENG' ORDER BY id LIMIT 1;");
const pmleCode = await scalar(`SELECT code FROM public.exam_domains WHERE id=${q(pmleDomain)};`);
await run(`BEGIN;
 INSERT INTO public.exam_domains(id,exam,code,name) VALUES (${q(certDomain)},'cloud-engineer',${q(pmleCode)},'Isolated ACE domain');
 INSERT INTO public.questions(id,exam,domain_id,stem,status,question_type)
 VALUES (${q(certQuestion)},'cloud-engineer',${q(certDomain)},'Isolated multiple-select storage fixture','DRAFT','multiple_select');
 INSERT INTO public.answers(question_id,choice_label,choice_text,is_correct)
 VALUES (${q(certQuestion)},'A','One',true),(${q(certQuestion)},'B','Two',true);
 ROLLBACK;`);
await denied(`BEGIN; INSERT INTO public.questions(exam,domain_id,stem,status)
 VALUES ('cloud-engineer',${q(pmleDomain)},'Cross-exam must fail','DRAFT'); ROLLBACK;`, "cross-exam domain rejected");
await denied(`BEGIN; INSERT INTO public.questions(exam,domain_id,stem,status,question_type)
 VALUES ('GCP_PM_ML_ENG',${q(pmleDomain)},'Unsupported live mode','ACTIVE','multiple_select'); ROLLBACK;`, "multiple-select cannot become live");
await denied(`BEGIN; INSERT INTO public.questions(exam,domain_id,stem,status,question_type)
 VALUES ('GCP_PM_ML_ENG',${q(pmleDomain)},'Unknown mode','DRAFT','unknown'); ROLLBACK;`, "unknown question type rejected");
console.log("PASS per-exam domain uniqueness, cross-exam FK, default single-select and non-live multiple-select storage");


await verifyBetaDiagnostics({ run, scalar, q, pmleDomain, pmleCode, digestSQL });

// Variant fixtures and every successful session/quota write roll back together.
const variantOwner = randomUUID(), variantParent = randomUUID(), variantId = randomUUID();
const variantFixture = `
 INSERT INTO auth.users(id) VALUES (${q(variantOwner)});
 INSERT INTO public.questions(id,exam,domain_id,stem,status)
 VALUES (${q(variantParent)},'GCP_PM_ML_ENG',${q(pmleDomain)},'Variant parent fixture','DRAFT');
 INSERT INTO public.questions(id,exam,domain_id,stem,status,parent_question_id)
 VALUES (${q(variantId)},'GCP_PM_ML_ENG',${q(pmleDomain)},'Variant fixture','DRAFT',${q(variantParent)});
`;
const variantSnapshot = (id) => [{ question_id: id, domain_code: pmleCode,
  domain_name: "Variant fixture", stem: "Variant fixture", correct_label: "A",
  options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }],
  // A spoofed snapshot flag must not override membership stored in questions.
  parent_question_id: null }];
const variantItems = q(JSON.stringify(variantSnapshot(variantId)));
const variantStrict = (items = variantItems) => `SELECT public.create_free_practice_session(${q(variantOwner)},${items}::jsonb,now()+interval '1 hour');`;
const variantTransaction = (sql) => `BEGIN; ${variantFixture} ${sql} ROLLBACK;`;
async function variantDenied(sql, sqlstate, reason) {
  const result = await run(`\\set VERBOSITY verbose
${variantTransaction(sql)}`, true);
  assert.notEqual(result.code, 0, reason);
  assert.match(result.error, new RegExp(sqlstate), reason + ": expected SQLSTATE");
}
await variantDenied(`UPDATE public.questions SET parent_question_id=id WHERE id=${q(variantParent)};`, "23514", "self-parent rejected");
await variantDenied(`UPDATE public.questions SET parent_question_id=${q(randomUUID())} WHERE id=${q(variantId)};`, "23503", "missing parent rejected");
await variantDenied(`DELETE FROM public.questions WHERE id=${q(variantParent)};`, "23503", "referenced parent deletion restricted");
assert.equal(await scalar("SELECT count(*) FROM pg_index WHERE indrelid='public.questions'::regclass AND indexrelid='public.questions_parent_question_id_idx'::regclass AND indisvalid;"), "1");
// The practice UI embeds one question per item through this FK to the PK.
assert.equal(await scalar(`SELECT count(*) FROM pg_constraint c
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
 JOIN pg_attribute target ON target.attrelid=c.confrelid AND target.attnum=ANY(c.confkey)
 WHERE c.contype='f' AND c.conrelid='public.session_items'::regclass
 AND c.confrelid='public.questions'::regclass AND a.attname='question_id'
 AND target.attname='id' AND a.attnotnull AND array_length(c.conkey,1)=1;`), "1");
await variantDenied(`SET LOCAL ROLE service_role; ${variantStrict()}`, "22023", "free RPC rejects bank variant despite spoofed null snapshot");
await variantDenied(`SET LOCAL ROLE service_role;
 SELECT public.create_study_session('practice',${q(variantOwner)},NULL,${variantItems}::jsonb,now()+interval '1 hour');`,
"42501", "unpaid legacy practice rejects variants");
for (const user of ["NULL", q(variantOwner)]) {
  const anonymous = user === "NULL" ? q("a".repeat(64)) : "NULL";
  await variantDenied(`SET LOCAL ROLE service_role;
    SELECT public.create_study_session('diagnostic',${user},${anonymous},${variantItems}::jsonb,now()+interval '1 hour');`,
  "22023", "anonymous and signed diagnostic RPCs reject variants");
}
await variantDenied(`SET LOCAL ROLE service_role;
 SELECT public.v2_create_study_session('diagnostic',NULL,${q("a".repeat(64))},${variantItems}::jsonb,now()+interval '1 hour',true);`,
"22023", "central diagnostic path cannot bypass variant guard");
await run(variantTransaction(`
 SET LOCAL ROLE service_role;
 DO $test$
 BEGIN
  BEGIN
   PERFORM public.create_free_practice_session(${q(variantOwner)},${variantItems}::jsonb,now()+interval '1 hour');
   RAISE EXCEPTION 'variant unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
   IF SQLERRM <> 'Variants are only available in paid practice' THEN RAISE; END IF;
  END;
  BEGIN
   PERFORM public.create_study_session('practice',${q(variantOwner)},NULL,${variantItems}::jsonb,now()+interval '1 hour');
   RAISE EXCEPTION 'unpaid legacy variant unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM <> 'Paid access required for variants' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(variantOwner)})
   OR EXISTS (SELECT 1 FROM public.study_sessions WHERE user_id=${q(variantOwner)}) THEN
   RAISE EXCEPTION 'variant rejection charged quota or created session';
  END IF;
 END;
 $test$;
 ${variantStrict(q(JSON.stringify(variantSnapshot(variantParent))))}
 DO $test$ BEGIN
 IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(variantOwner)})
 OR (SELECT count(*) FROM public.study_sessions WHERE user_id=${q(variantOwner)}) <> 1 THEN
  RAISE EXCEPTION 'parent free session must create one session without quota writes';
 END IF;
 END $test$;
`));
const variantPaidFixture = `INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status)
 VALUES (${q(variantOwner)},${q("local-variant-" + randomUUID())},'active');`;
await variantDenied(`${variantPaidFixture} SET LOCAL ROLE service_role; ${variantStrict()}`, "22023", "paid access cannot bypass strict free variant guard");
await run(variantTransaction(`${variantPaidFixture} SET LOCAL ROLE service_role;
 SELECT public.create_study_session('practice',${q(variantOwner)},NULL,${variantItems}::jsonb,now()+interval '1 hour');
 DO $test$ BEGIN
 IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(variantOwner)})
 OR (SELECT count(*) FROM public.study_sessions WHERE user_id=${q(variantOwner)}) <> 1 THEN
  RAISE EXCEPTION 'paid variant session must not charge free quota';
 END IF;
 END $test$;
`));
// Quota consumers must no longer run on any original-practice path. A rollback-only
// tripwire catches accidental calls without altering the deployed function.
await run(variantTransaction(`
 CREATE OR REPLACE FUNCTION public.consume_free_practice_quota(p_user_id UUID, p_question_count INTEGER)
 RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $race$
 BEGIN RAISE EXCEPTION 'obsolete quota consumer invoked'; END $race$;
 SET LOCAL ROLE service_role;
 SELECT public.create_study_session('practice',${q(variantOwner)},NULL,${q(JSON.stringify(variantSnapshot(variantParent)))}::jsonb,now()+interval '1 hour');
 ${variantStrict(q(JSON.stringify(variantSnapshot(variantParent))))}
 DO $test$ BEGIN
 IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(variantOwner)})
 OR (SELECT count(*) FROM public.study_sessions WHERE user_id=${q(variantOwner)}) <> 2 THEN
  RAISE EXCEPTION 'original practice must bypass obsolete quota accounting';
 END IF;
 END $test$;
`));
// The legacy wrapper must recheck current pass state, not trust the caller.
const variantPassFixture = (expires, refunded) => `INSERT INTO public.pmle_passes
 (user_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_customer_id,paid_at,expires_at,refunded_at)
 VALUES (${q(variantOwner)},${q("local-variant-checkout-" + randomUUID())},${q("local-variant-intent-" + randomUUID())},
 ${q("local-variant-customer-" + randomUUID())},now()-interval '2 days',${expires},${refunded});`;
for (const pass of [variantPassFixture("now()-interval '1 day'", "NULL"), variantPassFixture("now()+interval '88 days'", "now()")]) {
  await variantDenied(`${pass} SET LOCAL ROLE service_role;
   SELECT public.create_study_session('practice',${q(variantOwner)},NULL,${variantItems}::jsonb,now()+interval '1 hour');`,
  "42501", "expired and refunded passes cannot access variants");
}
await run(variantTransaction(`${variantPassFixture("now()+interval '88 days'", "NULL")}
 SET LOCAL ROLE service_role;
 SELECT public.create_study_session('practice',${q(variantOwner)},NULL,${variantItems}::jsonb,now()+interval '1 hour');
 DO $test$ BEGIN
 IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(variantOwner)}) THEN
  RAISE EXCEPTION 'valid pass variant charged free quota';
 END IF;
 END $test$;
`));
console.log("PASS variant parent FK/self-check/index, strict free and diagnostic rejection, rollback, quota-free originals and paid inclusion");

const owner = randomUUID(), other = randomUUID(), paidOwner = randomUUID(), legacyOwner = randomUUID();
const strictOwner = randomUUID(), claimOwner = randomUUID(), claimOther = randomUUID();
const phase3Fixtures = ["race", "refund-first", "grant-first"].map((name) => ({
  name, owner: randomUUID(), intent: "local-test-" + randomUUID(),
  checkout: "local-checkout-" + randomUUID(), customer: "local-customer-" + randomUUID(),
}));
const ownerIds = [owner, other, paidOwner, legacyOwner, strictOwner, claimOwner, claimOther,
  ...phase3Fixtures.map((fixture) => fixture.owner)];
const hash = createHash("sha256").update(randomUUID()).digest("hex");
const claimHash = createHash("sha256").update(randomUUID()).digest("hex");
const foreignHash = createHash("sha256").update(randomUUID()).digest("hex");
const intent = "local-test-" + randomUUID();
const intentAfter = "local-test-" + randomUUID();
const checkout = "local-checkout-" + randomUUID();
const afterCheckout = "local-checkout-" + randomUUID();
let sessionId;
try {
  await run(`INSERT INTO auth.users(id) VALUES ${ownerIds.map((id) => `(${q(id)})`).join(",")};`);
  const questions = JSON.parse(await scalar(`SELECT json_agg(s) FROM (SELECT q.id AS question_id,d.code AS domain_code,d.name AS domain_name,q.stem,
    (SELECT json_agg(json_build_object('label',a.choice_label,'text',a.choice_text) ORDER BY a.choice_label) FROM public.answers a WHERE a.question_id=q.id) AS options,
    (SELECT a.choice_label FROM public.answers a WHERE a.question_id=q.id AND a.is_correct) AS correct_label
    FROM public.questions q JOIN public.exam_domains d ON d.id=q.domain_id
    WHERE ${prodSchema ? "q.status='ACTIVE' AND q.review_status='GOOD' AND q.exam='GCP_PM_ML_ENG'" : "q.source_ref LIKE 'local-educational-seed-%'"} ORDER BY q.id LIMIT 6) s;`));
  assert.equal(questions.length, 6);
  // Pass-only mocks use separate snapshots and never leak keys through their RPC.
  // An existing local mirror may have retired the educational seed rows. Do not
  // reactivate them: mocks must use the current eligible original bank instead.
  const mockBank = JSON.parse(await scalar(`SELECT json_agg(s) FROM (SELECT q.id AS question_id,d.code AS domain_code,d.name AS domain_name,q.stem,
    (SELECT json_agg(json_build_object('label',a.choice_label,'text',a.choice_text) ORDER BY a.choice_label) FROM public.answers a WHERE a.question_id=q.id) AS options,
    (SELECT a.choice_label FROM public.answers a WHERE a.question_id=q.id AND a.is_correct) AS correct_label
    FROM public.questions q JOIN public.exam_domains d ON d.id=q.domain_id
    WHERE q.status='ACTIVE' AND q.review_status='GOOD' AND q.exam='GCP_PM_ML_ENG' AND q.parent_question_id IS NULL ORDER BY q.id LIMIT 6) s;`));
  assert.equal(mockBank.length, 6, "eligible original bank supplies mock fixtures");
  const mockSnapshots = Array.from({ length: 50 }, (_, index) => mockBank[index % mockBank.length]);
  const mockCreate = (user, snapshots = mockSnapshots) => `SELECT public.create_mock_exam(${q(user)},${q(JSON.stringify(snapshots))}::jsonb,'Isolated integration fixture: repeated bank questions');`;
  const mockInteract = (user, id, action, item = null, label = null) => `SELECT public.interact_mock_exam(${q(user)},${q(id)},${q(action)},${item ? q(item) : "NULL"},${label ? q(label) : "NULL"});`;
  await denied(service(mockCreate(owner)), "free account cannot create mock through trusted RPC");
  await run(`INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status) VALUES
    (${q(owner)},${q("local-mock-owner-" + randomUUID())},'active'),(${q(other)},${q("local-mock-foreign-" + randomUUID())},'active');`);
  const mockId = await scalar(service(mockCreate(owner)));
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_items WHERE session_id=${q(mockId)};`), "50");
  assert.equal(await scalar(`SELECT abs(extract(epoch FROM deadline_at-created_at)-7200)<0.1 FROM public.mock_exam_sessions WHERE id=${q(mockId)};`), "t", "server fixes mock timer at120minutes");
  await denied(service(mockInteract(other, mockId, "read")), "foreign paid owner cannot read mock");
  await denied(service(mockCreate(owner, mockSnapshots.slice(0, 49))), "mock requires exactly50 snapshots");
  await denied(service(mockCreate(owner, mockSnapshots.map((item, index) => index === 0 ? { ...item, stem: "Forged snapshot" } : item))), "mock validates canonical bank snapshot");
  await denied(service(mockCreate(owner, mockSnapshots.map((item, index) => index === 49 ? { ...item, question_id: randomUUID() } : item))), "invalid final item rolls back all49 prior inserts");
  const duplicateText = mockSnapshots.map((item, index) => index === 0 ? { ...item, options: item.options.map((option, optionIndex) => optionIndex === 1 ? { ...option, text: item.options[0].text } : option) } : item);
  await denied(service(mockCreate(owner, duplicateText)), "duplicate mock option text rejected");
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_sessions WHERE user_id=${q(owner)};`), "1", "invalid snapshots roll back complete session");
  const mockItems = JSON.parse(await scalar(`SELECT json_agg(i ORDER BY ordinal) FROM (SELECT id,ordinal,correct_label,options FROM public.mock_exam_items WHERE session_id=${q(mockId)}) i;`));
  const firstMock = mockItems[0];
  await denied(service(mockInteract(owner, mockId, "answer", randomUUID(), firstMock.correct_label)), "foreign mock item rejected");
  await denied(service(mockInteract(owner, mockId, "answer", firstMock.id, "INVALID")), "invalid mock option rejected");
  const answeredMock = JSON.parse(await scalar(service(mockInteract(owner, mockId, "answer", firstMock.id, firstMock.correct_label))));
  assert.equal(answeredMock.answered_count, 1); assert.equal(answeredMock.completed_at, null);
  for (const key of ["correct_label", "is_correct", "score", "questions", "items", "explanation"]) assert.ok(!(key in answeredMock), `mock RPC does not return${key}`);
  const resumedMock = JSON.parse(await scalar(service(mockInteract(owner, mockId, "read"))));
  assert.equal(resumedMock.deadline_at, answeredMock.deadline_at, "resume does not reset deadline");
  assert.equal(await scalar(`SELECT selected_label FROM public.mock_exam_items WHERE id=${q(firstMock.id)};`), firstMock.correct_label);
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_items WHERE session_id=${q(mockId)} AND is_correct IS NOT NULL;`), "0", "no per-question reveal/scoring while mock active");
  const submittedMock = JSON.parse(await scalar(service(mockInteract(owner, mockId, "submit"))));
  assert.ok(submittedMock.completed_at); assert.equal(submittedMock.timed_out, false);
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_items WHERE session_id=${q(mockId)} AND is_correct;`), "1", "submit scores saved answer, blanks incorrect");
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_items WHERE session_id=${q(mockId)} AND is_correct IS NOT NULL;`), "50");
  const alternateMockLabel = firstMock.options.find(option => option.label !== firstMock.correct_label).label;
  await run(service(mockInteract(owner, mockId, "answer", firstMock.id, alternateMockLabel)));
  assert.equal(await scalar(`SELECT selected_label FROM public.mock_exam_items WHERE id=${q(firstMock.id)};`), firstMock.correct_label, "post-submit answers cannot mutate exam");
  const timerMock = await scalar(service(mockCreate(owner)));
  const timerItem = await scalar(`SELECT id FROM public.mock_exam_items WHERE session_id=${q(timerMock)} AND ordinal=1;`);
  await run(`UPDATE public.mock_exam_sessions SET created_at=clock_timestamp()-interval '121 minutes',deadline_at=clock_timestamp()-interval '1 minute' WHERE id=${q(timerMock)};`);
  const expiredMock = JSON.parse(await scalar(service(mockInteract(owner, timerMock, "answer", timerItem, firstMock.correct_label))));
  assert.ok(expiredMock.completed_at); assert.equal(expiredMock.timed_out, true);
  assert.equal(expiredMock.answered_count, 0, "late answer is not saved");
  assert.equal(await scalar(`SELECT count(*) FROM public.mock_exam_items WHERE session_id=${q(timerMock)} AND NOT is_correct;`), "50", "expired unanswered mock auto-submits as zero");
  // Prove the wall clock is checked after lock acquisition, not at statement
  // start. The queued answer began before its deadline but obtains the row late.
  const lockedMock = await scalar(service(mockCreate(owner)));
  const lockedItem = await scalar(`SELECT id FROM public.mock_exam_items WHERE session_id=${q(lockedMock)} AND ordinal=1;`);
  await run(`UPDATE public.mock_exam_sessions SET deadline_at=clock_timestamp()+interval '1 second' WHERE id=${q(lockedMock)};`);
  const deadlineLock = await openRowLock(`SELECT id FROM public.mock_exam_sessions WHERE id=${q(lockedMock)} FOR UPDATE`);
  let queuedAnswer;
  try {
    queuedAnswer = run(service(mockInteract(owner, lockedMock, "answer", lockedItem, firstMock.correct_label)));
    await delay(100);
    assert.equal(await scalar(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%${lockedMock}%';`), "1", "answer is demonstrably queued on held mock row");
    await delay(1_100);
  } finally { deadlineLock.release(); await deadlineLock.completed; }
  const lockedExpiry = JSON.parse((await queuedAnswer).output);
  assert.equal(lockedExpiry.timed_out, true); assert.equal(lockedExpiry.answered_count, 0);
  assert.equal(await scalar(`SELECT completed_at=deadline_at FROM public.mock_exam_sessions WHERE id=${q(lockedMock)};`), "t");
  const scoredOnce = await scalar(`SELECT row_to_json(s) FROM public.mock_exam_sessions s WHERE id=${q(lockedMock)};`);
  await run(service(mockInteract(owner, lockedMock, "results")));
  assert.equal(await scalar(`SELECT row_to_json(s) FROM public.mock_exam_sessions s WHERE id=${q(lockedMock)};`), scoredOnce, "timeout results are idempotent");
  // Revocation while an authorized read waits on the row must win when it wakes.
  const revocationLock = await openRowLock(`SELECT id FROM public.mock_exam_sessions WHERE id=${q(mockId)} FOR UPDATE`);
  let queuedRead;
  try {
    queuedRead = run(service(mockInteract(owner, mockId, "read")), true);
    await delay(100);
    assert.equal(await scalar(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%${mockId}%';`), "1", "read is queued before revocation");
    await run(`UPDATE public.user_subscriptions SET status='canceled' WHERE user_id=${q(owner)};`);
  } finally { revocationLock.release(); await revocationLock.completed; }
  assert.notEqual((await queuedRead).code, 0, "paid access is rechecked after waiting for the row");
  console.log("PASS real queued-answer deadline race, idempotent timeout scoring and queued-read access revocation");

  await denied(service(mockInteract(owner, mockId, "results")), "revoked paid access cannot read prior mock");
  await denied(service(mockCreate(owner)), "revoked paid access cannot start another mock");
  await run(`DELETE FROM public.mock_exam_sessions WHERE user_id IN (${q(owner)},${q(other)}); DELETE FROM public.user_subscriptions WHERE user_id IN (${q(owner)},${q(other)});`);
  console.log("PASS Pass-only mock RPC/table isolation, canonical snapshots, fixed timer, safe resume, submit scoring, immutable completion, expiry and revocation");

  const items = prodSchema ? questions : questions.map((question) => ({ ...question,
    options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }], correct_label: "A" }));
  const firstCorrect = items[0].correct_label;
  const firstWrong = items[0].options.find(option => option.label !== firstCorrect).label;
  const secondCorrect = items[1].correct_label;
  const createSQL = (kind, user, anonymous, snapshots) => `SELECT public.create_study_session(${q(kind)},${user ? q(user) : "NULL"},${anonymous ? q(anonymous) : "NULL"},${q(JSON.stringify(snapshots))}::jsonb,now()+interval '1 hour')`;
  const paidSQL = (user, snapshots) => `SELECT public.create_pass_practice_session(${q(user)},${q(JSON.stringify(snapshots))}::jsonb,now()+interval '1 hour')`;
  const strictSQL = (user, snapshots) => `SELECT public.create_free_practice_session(${q(user)},${q(JSON.stringify(snapshots))}::jsonb,now()+interval '1 hour')`;
  await denied(service(paidSQL(owner, items.slice(0, 5))), "free account cannot invoke paid-practice RPC");
  const claimSQL = (user, digest) => `SELECT public.claim_anonymous_diagnostics(${user ? q(user) : "NULL"},${digest === null ? "NULL" : q(digest)})`;
  sessionId = await scalar(service(createSQL("diagnostic", null, hash, items.slice(0, 2))));
  const rows = JSON.parse(await scalar(`SELECT json_agg(s ORDER BY ordinal) FROM (SELECT id,ordinal FROM public.session_items WHERE session_id=${q(sessionId)}) s;`));
  const answerSQL = (id, label, user = null, anonymous = hash) => `SELECT public.answer_study_item(${q(sessionId)},${q(id)},${q(label)},${user ? q(user) : "NULL"},${anonymous ? q(anonymous) : "NULL"})`;
  await denied(service(answerSQL(rows[0].id, firstCorrect, other, null)), "foreign user cannot answer anonymous session");
  await denied(service(answerSQL(rows[0].id, firstCorrect, null, "0".repeat(64))), "wrong anonymous owner denied");
  await denied(service(answerSQL(rows[1].id, secondCorrect)), "out of order answer denied");
  await denied(service(answerSQL(rows[0].id, "INVALID")), "unknown option denied");
  const first = JSON.parse(await scalar(service(answerSQL(rows[0].id, firstWrong))));
  assert.deepEqual(first, { answeredCount: 1, totalQuestions: 2, completed: false });
  assert.deepEqual(JSON.parse(await scalar(service(answerSQL(rows[0].id, firstWrong)))), first, "same answer retry idempotent");
  await denied(service(answerSQL(rows[0].id, firstCorrect)), "changed answer rejected");
  assert.deepEqual(JSON.parse(await scalar(service(answerSQL(rows[1].id, secondCorrect)))), { answeredCount: 2, totalQuestions: 2, completed: true });
  assert.equal(await scalar(`SELECT count(*) FROM public.session_items WHERE session_id=${q(sessionId)} AND is_correct;`), "1");
  assert.equal(await scalar(`SELECT completed_at IS NOT NULL FROM public.study_sessions WHERE id=${q(sessionId)};`), "t");
  // Expiry checked independently of item state.
  await run(`UPDATE public.study_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id=${q(sessionId)};`);
  await denied(service(answerSQL(rows[0].id, firstWrong)), "expired session denied");
  console.log("PASS anonymous ownership, next ordinal, options, retry, server correctness, completion, expiry");

  const monthSQL = "date_trunc('month', now() AT TIME ZONE 'UTC')::date";
  // Historical exhausted rows are inert. Every concurrent start succeeds for free.
  await run(`INSERT INTO public.free_practice_quota (user_id,month_start,questions_used) VALUES (${q(owner)},${monthSQL},60);`);
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => run(service(createSQL("practice", owner, null, items.slice(0, 1))), true)));
  assert.equal(concurrent.filter(result => result.code === 0).length, 8, "all free starts succeed after historical sixty-question usage");
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(owner)} AND month_start=${monthSQL};`), "60", "historical quota unchanged");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(owner)};`), "8");
  const invalidItem = { ...items[0], question_id: randomUUID() };
  await denied(service(createSQL("practice", other, null, [invalidItem])), "failed snapshot rolls back session");
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)};`), "0");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(other)};`), "0");
  await run(`INSERT INTO public.free_practice_quota (user_id,month_start,questions_used) VALUES (${q(other)},(${monthSQL} - interval '1 month')::date,60);`);
  await scalar(service(strictSQL(other, items.slice(0, 1))));
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)} AND month_start=${monthSQL};`), "0", "no new monthly bucket");
  await run(`DELETE FROM public.study_sessions WHERE user_id=${q(other)}; DELETE FROM public.free_practice_quota WHERE user_id=${q(other)};`);
  await run(`INSERT INTO public.free_practice_quota (user_id,month_start,questions_used) VALUES (${q(strictOwner)},${monthSQL},60);`);
  const strictConcurrent = await Promise.all(Array.from({ length: 8 }, () => run(service(strictSQL(strictOwner, items.slice(0, 5))), true)));
  assert.equal(strictConcurrent.filter(result => result.code === 0).length, 8, "strict free starts have no monthly cap");
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(strictOwner)};`), "60");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(strictOwner)} AND kind='practice';`), "8");
  assert.equal(await scalar(`SELECT count(*) FROM public.session_items i JOIN public.study_sessions s ON s.id=i.session_id WHERE s.user_id=${q(strictOwner)};`), "40");
  await denied(service(strictSQL(other, [invalidItem])), "strict snapshot FK failure rolls back session");
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)};`), "0");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(other)};`), "0");
  console.log("PASS quota-free concurrent starts, inert exhausted historical buckets, no monthly writes and snapshot rollback");

  // Claims attach every diagnostic for the cookie, including completed/expired rows, once only.
  const claimSessions = await Promise.all(Array.from({ length: 3 }, () => scalar(service(createSQL("diagnostic", null, claimHash, items.slice(0, 1))))));
  const foreignSession = await scalar(service(createSQL("diagnostic", null, foreignHash, items.slice(0, 1))));
  const completedClaimItem = await scalar(`SELECT id FROM public.session_items WHERE session_id=${q(claimSessions[1])};`);
  await run(service(`SELECT public.answer_study_item(${q(claimSessions[1])},${q(completedClaimItem)},${q(firstCorrect)},NULL,${q(claimHash)})`));
  await run(`UPDATE public.study_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id IN (${q(claimSessions[1])},${q(claimSessions[2])});`);
  await denied(service(claimSQL(null, claimHash)), "claim requires a verified user ID");
  for (const invalid of [null, "", "a".repeat(63), "A".repeat(64)]) {
    await denied(service(claimSQL(claimOwner, invalid)), "claim requires a lowercase 64-hex hash");
  }
  assert.equal(await scalar(service(claimSQL(claimOwner, "0".repeat(64)))), "0", "another cookie cannot claim these sessions");
  const claims = await Promise.all([claimOwner, claimOther].map((id) => scalar(service(claimSQL(id, claimHash)))));
  assert.deepEqual(claims.map(Number).sort(), [0, 3], "concurrent users: one claims all rows, one claims none");
  const winningOwner = claims[0] === "3" ? claimOwner : claimOther;
  const losingOwner = winningOwner === claimOwner ? claimOther : claimOwner;
  assert.equal(await scalar(service(claimSQL(winningOwner, claimHash))), "0", "duplicate claim is idempotent");
  assert.equal(await scalar(service(claimSQL(losingOwner, claimHash))), "0", "already claimed rows cannot be reassigned");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE id IN (${claimSessions.map(q).join(",")}) AND user_id=${q(winningOwner)} AND anonymous_owner_hash IS NULL;`), "3");
  assert.equal(await scalar(`SELECT user_id IS NULL AND anonymous_owner_hash=${q(foreignHash)} FROM public.study_sessions WHERE id=${q(foreignSession)};`), "t", "foreign cookie row untouched");
  const claimedItem = await scalar(`SELECT id FROM public.session_items WHERE session_id=${q(claimSessions[0])};`);
  const claimAnswer = (user, digest) => `SELECT public.answer_study_item(${q(claimSessions[0])},${q(claimedItem)},${q(firstCorrect)},${user ? q(user) : "NULL"},${digest ? q(digest) : "NULL"})`;
  await denied(service(claimAnswer(null, claimHash)), "old anonymous cookie loses access after claim");
  await denied(service(claimAnswer(losingOwner, null)), "losing signed user cannot access claimed row");
  assert.equal(JSON.parse(await scalar(service(claimAnswer(winningOwner, null)))).completed, true, "signed owner can answer claimed row");
  const claimRead = (user) => `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${q(user)},true); SELECT count(*) FROM public.study_sessions WHERE id IN (${claimSessions.map(q).join(",")}); ROLLBACK;`;
  assert.equal((await scalar(claimRead(winningOwner))).split("\n").at(-1), "3", "claimed metadata owned RLS");
  assert.equal((await scalar(claimRead(losingOwner))).split("\n").at(-1), "0", "claimed metadata hidden from foreign signed user");
  console.log("PASS hash-only bulk claim validation, duplicate/foreign/two-user concurrency, old-cookie denial and signed metadata RLS");

  const userSession = await scalar(service(createSQL("diagnostic", owner, null, items.slice(0, 1))));
  const authRead = (id) => `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${q(id)},true); SELECT count(*) FROM public.study_sessions WHERE id=${q(userSession)}; ROLLBACK;`;
  assert.equal((await scalar(authRead(owner))).split("\n").at(-1), "1", "owner can read metadata");
  assert.equal((await scalar(authRead(other))).split("\n").at(-1), "0", "foreign metadata hidden by RLS");
  await denied(`BEGIN; SET LOCAL ROLE authenticated; UPDATE public.study_sessions SET completed_at=now() WHERE id=${q(userSession)}; ROLLBACK;`, "browser cannot write session state");
  // Regression: a restored legacy broad SELECT policy must not OR away ownership.
  // DDL lives only in this transaction; ROLLBACK removes the fixture without policy drops.
  const broadPolicy = "local_broad_" + randomUUID().replaceAll("-", "");
  const broadRead = (id) => `BEGIN;
    CREATE POLICY ${broadPolicy} ON public.study_sessions FOR SELECT TO authenticated USING (true);
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub',${q(id)},true);
    SELECT count(*) FROM public.study_sessions WHERE id=${q(userSession)};
    ROLLBACK;`;
  assert.equal((await scalar(broadRead(other))).split("\n").at(-1), "0", "restrictive gate defeats legacy broad SELECT for foreign owner");
  assert.equal((await scalar(broadRead(owner))).split("\n").at(-1), "1", "restrictive gate still permits own metadata with broad fixture");
  assert.equal(await scalar(`SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='study_sessions' AND policyname=${q(broadPolicy)};`), "0", "fixture policy rolled back");
  console.log("PASS concurrent five-question limit, transactional rollback, owned metadata RLS, legacy broad-policy isolation, browser write denial");

  // Phase 3: independent psql transactions race on the same intent/session.
  // A non-UTC zone spans DST: the pass is exactly 90 * 24 hours, not 90 calendar days.
  const phase3PaidAt = "2026-03-07T12:00:00Z", phase3RefundedAt = "2026-03-07T13:00:00Z";
  const phase3PaidEpoch = Date.parse(phase3PaidAt) / 1000;
  const phase3RefundedEpoch = Date.parse(phase3RefundedAt) / 1000;
  const phase3FulfillSQL = (fixture) => `SET LOCAL TIME ZONE 'America/New_York';
    SELECT id FROM public.fulfill_pmle_pass(${q(fixture.owner)},${q(fixture.checkout)},${q(fixture.intent)},${q(fixture.customer)},${q(phase3PaidAt)}::timestamptz)`;
  const phase3RefundSQL = (fixture) => `SELECT public.refund_pmle_pass(${q(fixture.intent)},${q(phase3RefundedAt)}::timestamptz)`;
  const phase3ReceiptSQL = (fixture, amount = 3900, currency = "usd") =>
    `SELECT public.record_pmle_pass_payment(${q(fixture.intent)},${amount},${q(currency)})`;
  // Collect every transaction before asserting, so finally cannot race pending fixture writes.
  // Completion records its receipt only after fulfillment exists in the same transaction.
  const phase3Replay = (fixture) => Array.from({ length: 8 }, () =>
    run(service(`${phase3FulfillSQL(fixture)}; ${phase3ReceiptSQL(fixture)}`), true));
  const phase3AssertSuccess = (results, name) => {
    for (const result of results) assert.equal(result.code, 0, `${name}: RPC must succeed: ${result.error}`);
  };
  const phase3ReceiptSnapshot = async (fixture, refunded) => {
    assert.equal(await scalar(`SELECT count(*) FROM public.payment_history
      WHERE user_id=${q(fixture.owner)} OR stripe_payment_intent_id=${q(fixture.intent)};`), "1",
    `${fixture.name}: exactly one payment history row`);
    const receipt = JSON.parse(await scalar(`SELECT row_to_json(p) FROM public.payment_history p
      WHERE stripe_payment_intent_id=${q(fixture.intent)};`));
    assert.deepEqual({
      user_id: receipt.user_id, stripe_payment_intent_id: receipt.stripe_payment_intent_id,
      amount: receipt.amount, currency: receipt.currency, status: receipt.status,
    }, {
      user_id: fixture.owner, stripe_payment_intent_id: fixture.intent,
      amount: 3900, currency: "usd", status: refunded ? "refunded" : "succeeded",
    }, `${fixture.name}: receipt derives the pass owner, preserves 3900/usd and follows refund state`);
    return receipt;
  };
  const phase3Snapshot = async (fixture, expectedId, refunded) => {
    assert.equal(await scalar(`SELECT count(*) FROM public.pmle_passes
      WHERE user_id=${q(fixture.owner)} OR stripe_payment_intent_id=${q(fixture.intent)}
      OR stripe_checkout_session_id=${q(fixture.checkout)};`), "1", `${fixture.name}: exactly one pass row`);
    const pass = JSON.parse(await scalar(`SELECT row_to_json(p) FROM (
      SELECT id,user_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_customer_id,
        extract(epoch FROM paid_at) AS paid_epoch,extract(epoch FROM expires_at) AS expires_epoch,
        extract(epoch FROM refunded_at) AS refunded_epoch
      FROM public.pmle_passes WHERE stripe_payment_intent_id=${q(fixture.intent)}
    ) p;`));
    assert.deepEqual(pass, {
      id: expectedId, user_id: fixture.owner, stripe_checkout_session_id: fixture.checkout,
      stripe_payment_intent_id: fixture.intent, stripe_customer_id: fixture.customer,
      paid_epoch: phase3PaidEpoch, expires_epoch: phase3PaidEpoch + 90 * 24 * 60 * 60,
      refunded_epoch: refunded ? phase3RefundedEpoch : null,
    }, `${fixture.name}: identity, paid time, exact 2160-hour expiry and refund state`);
    assert.equal(await scalar(`SELECT count(*) FROM public.pmle_pass_refunds
      WHERE stripe_payment_intent_id=${q(fixture.intent)};`), refunded ? "1" : "0",
    `${fixture.name}: refund tombstone count`);
    if (refunded) {
      assert.equal(Number(await scalar(`SELECT extract(epoch FROM refunded_at) FROM public.pmle_pass_refunds
        WHERE stripe_payment_intent_id=${q(fixture.intent)};`)), phase3RefundedEpoch,
      `${fixture.name}: tombstone timestamp dominates fulfillment`);
    }
    return { pass, receipt: await phase3ReceiptSnapshot(fixture, refunded) };
  };
  const phase3ReceiptRace = async (fixture) => {
    const receipts = await Promise.all([
      ...Array.from({ length: 8 }, () => run(service(phase3ReceiptSQL(fixture)), true)),
      run(service(phase3RefundSQL(fixture)), true),
    ]);
    phase3AssertSuccess(receipts, `${fixture.name}: receipt/refund race`);
  };
  const phase3ReplayAfterRefund = async (fixture, passId, beforeReplay) => {
    await phase3ReceiptRace(fixture);
    assert.deepEqual(await phase3Snapshot(fixture, passId, true), beforeReplay,
      `${fixture.name}: eight concurrent receipt writes and refund preserve one refunded receipt`);
    const completions = await Promise.all(phase3Replay(fixture));
    phase3AssertSuccess(completions, fixture.name);
    assert.deepEqual(completions.map((result) => result.output), Array(8).fill(passId),
      `${fixture.name}: all completion replays retain the same pass ID`);
    assert.deepEqual(await phase3Snapshot(fixture, passId, true), beforeReplay,
      `${fixture.name}: completion replay cannot restore access, change expiry or reset receipt status`);
    for (const [amount, currency] of [[3901, "usd"], [3900, "eur"]]) {
      await denied(service(phase3ReceiptSQL(fixture, amount, currency)),
        `${fixture.name}: mismatched receipt amount/currency denied`);
      assert.deepEqual(await phase3Snapshot(fixture, passId, true), beforeReplay,
        `${fixture.name}: rejected receipt mismatch cannot mutate pass or payment history`);
    }
  };

  const [raceFixture, refundFirstFixture, grantFirstFixture] = phase3Fixtures;
  // Start eight identical fulfillment RPCs and the refund without awaiting either side.
  const raced = await Promise.all([
    ...phase3Replay(raceFixture), run(service(phase3RefundSQL(raceFixture)), true),
  ]);
  phase3AssertSuccess(raced, raceFixture.name);
  const racedIds = raced.slice(0, 8).map((result) => result.output);
  assert.match(racedIds[0], /^[0-9a-f-]{36}$/, "race: fulfillment returns a pass UUID");
  assert.deepEqual(racedIds, Array(8).fill(racedIds[0]), "race: all fulfillments return one identity");
  await phase3ReplayAfterRefund(raceFixture, racedIds[0],
    await phase3Snapshot(raceFixture, racedIds[0], true));

  // Deterministic refund-before-fulfillment exercises the tombstone insert path.
  await run(service(phase3RefundSQL(refundFirstFixture)));
  const refundFirstResults = await Promise.all(phase3Replay(refundFirstFixture));
  phase3AssertSuccess(refundFirstResults, refundFirstFixture.name);
  const refundFirstId = refundFirstResults[0].output;
  assert.deepEqual(refundFirstResults.map((result) => result.output), Array(8).fill(refundFirstId),
    "refund-first: all concurrent fulfillments return one identity");
  await phase3ReplayAfterRefund(refundFirstFixture, refundFirstId,
    await phase3Snapshot(refundFirstFixture, refundFirstId, true));

  // Deterministic grant-before-refund exercises revocation of the existing pass.
  const grantFirstId = await scalar(service(phase3FulfillSQL(grantFirstFixture)));
  await run(service(phase3ReceiptSQL(grantFirstFixture)));
  const granted = await phase3Snapshot(grantFirstFixture, grantFirstId, false);
  const purchaseClaimSQL = `UPDATE public.pmle_passes SET purchase_completed_at=now()
    WHERE id=${q(grantFirstId)} AND refunded_at IS NULL AND purchase_completed_at IS NULL RETURNING id`;
  const purchaseClaims = await Promise.all(Array.from({ length: 8 }, () => run(service(purchaseClaimSQL))));
  assert.equal(purchaseClaims.filter(result => result.output === grantFirstId).length, 1,
    "eight parallel return/webhook analytics claims have exactly one winner");
  await run(`UPDATE public.pmle_passes SET purchase_completed_at=NULL WHERE id=${q(grantFirstId)}`);
  await phase3ReceiptRace(grantFirstFixture);
  const revoked = await phase3Snapshot(grantFirstFixture, grantFirstId, true);
  assert.deepEqual(revoked, {
    pass: { ...granted.pass, refunded_epoch: phase3RefundedEpoch },
    receipt: { ...granted.receipt, status: "refunded" },
  }, "grant-first: refund changes only pass refund state and receipt status, not identities or expiry");
  await phase3ReplayAfterRefund(grantFirstFixture, grantFirstId, revoked);
  console.log("PASS Phase 3 eight-way fulfillment/receipt/refund races, refund-first and grant-first tombstone dominance, immutable completion/receipt replay, receipt mismatch denial and DST-safe 2160-hour expiry");

  const paidAt = "2026-10-03T12:00:00Z", refundedAt = "2026-10-03T13:00:00Z";
  const fulfill = (pi, cs) => `SELECT id FROM public.fulfill_pmle_pass(${q(paidOwner)},${q(cs)},${q(pi)},'local-customer',${q(paidAt)}::timestamptz)`;
  await run(service(`SELECT public.refund_pmle_pass(${q(intent)},${q(refundedAt)}::timestamptz)`));
  const passId = await scalar(service(fulfill(intent, checkout)));
  assert.equal(await scalar(`SELECT refunded_at IS NOT NULL FROM public.pmle_passes WHERE id=${q(passId)};`), "t", "refund-before-fulfillment persists");
  assert.equal(await scalar(service(fulfill(intent, checkout))), passId, "fulfillment duplicate retains identity");
  await denied(service(fulfill(intent, checkout).replace("'local-customer'", "'different-customer'")), "changed fulfillment identity rejected");
  const validPassId = await scalar(service(fulfill(intentAfter, afterCheckout)));
  assert.equal(await scalar(`SELECT expires_at-paid_at=interval '2160 hours' FROM public.pmle_passes WHERE id=${q(validPassId)};`), "t");
  // Make the test independent of today's date without changing the verified RPC semantics.
  await run(`UPDATE public.pmle_passes SET paid_at=now()-interval '1 hour',expires_at=now()+interval '90 days' WHERE id=${q(validPassId)};`);
  await run(service(paidSQL(paidOwner, items)));
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(paidOwner)};`), "0", "valid pass bypasses free counter");
  await run(`INSERT INTO public.free_practice_quota(user_id,month_start,questions_used) VALUES (${q(paidOwner)},${monthSQL},55);`);
  await run(service(strictSQL(paidOwner, items.slice(0, 5))));
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(paidOwner)};`), "55", "strict free path does not charge valid pass holder");
  await run(service(strictSQL(paidOwner, items.slice(0, 1))));
  await run(service(`SELECT public.refund_pmle_pass(${q(intentAfter)},now())`));
  await denied(service(paidSQL(paidOwner, items.slice(0, 5))), "refunded pass cannot invoke paid-practice RPC");
  await run(service(createSQL("practice", paidOwner, null, items)));
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(paidOwner)};`), "55", "refund does not revoke free unlimited practice");
  await run(`INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status,current_period_end) VALUES (${q(legacyOwner)},${q("local-legacy-" + randomUUID())},'active',NULL);`);
  await run(service(createSQL("practice", legacyOwner, null, items)));
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(legacyOwner)};`), "0", "legacy active subscription bypasses quota");
  await run(`INSERT INTO public.free_practice_quota(user_id,month_start,questions_used) VALUES (${q(legacyOwner)},${monthSQL},55);`);
  await run(service(strictSQL(legacyOwner, items.slice(0, 5))));
  await run(service(strictSQL(legacyOwner, items.slice(0, 1))));
  await run(service(strictSQL(paidOwner, items.slice(0, 1))));
  await run(`UPDATE public.pmle_passes SET paid_at=now()-interval '2 days',expires_at=now()-interval '1 day',refunded_at=NULL WHERE id=${q(validPassId)};`);
  await run(service(strictSQL(paidOwner, items.slice(0, 1))));
  await denied(service(paidSQL(paidOwner, items.slice(0, 5))), "expired pass cannot invoke paid-practice RPC");
  await run(`UPDATE public.pmle_passes SET paid_at=now()+interval '1 day',expires_at=now()+interval '91 days' WHERE id=${q(validPassId)};`);
  await denied(service(paidSQL(paidOwner, items.slice(0, 5))), "future-paid pass cannot invoke paid-practice RPC");
  await run(service(paidSQL(legacyOwner, items.slice(0, 5))));
  console.log("PASS paid-practice RPC rechecks valid/refunded/expired/future-paid access and accepts active legacy subscription");
  console.log("PASS quota-free original practice for valid/refunded/expired pass and legacy accounts");
  console.log("PASS refund-before/after fulfillment, duplicate identity, 2160-hour expiry, paid/legacy practice access");
} finally {
  // Only isolated generated owners/anonymous hash and fake payment intents are removed.
  await run(`DELETE FROM public.study_sessions WHERE anonymous_owner_hash IN (${q(hash)},${q(claimHash)},${q(foreignHash)});
    DELETE FROM public.pmle_pass_refunds WHERE stripe_payment_intent_id IN (${[intent, intentAfter, ...phase3Fixtures.map((fixture) => fixture.intent)].map(q).join(",")});
    DELETE FROM auth.users WHERE id IN (${ownerIds.map(q).join(",")});`);
  if (prodSchema) assert.equal(await scalar(bankDigestSQL), bankBefore, "all five restored question-bank tables remain byte-for-byte unchanged after every integration group");
}
console.log(`PASS all local DB integration checks; isolated fixtures removed${prodSchema ? "; restored question bank unchanged" : ""}`);
