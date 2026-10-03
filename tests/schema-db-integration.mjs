/** Local SQL integration verifier. Run: DATABASE_URL=<local URL> node tests/schema-db-integration.mjs
 * Requires psql on PATH. Never loads an env file or uses a hosted service.
 * Adds isolated test owners and removes their rows in finally; no real users/keys.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
const q = (text) => "'" + String(text).replaceAll("'", "''") + "'";
const scalar = async (sql) => (await run(sql)).output;
const service = (sql) => "BEGIN; SET LOCAL ROLE service_role; " + sql + "; COMMIT;";
async function denied(sql, reason) {
  const result = await run(sql, true);
  assert.notEqual(result.code, 0, reason);
}
const tables = ["exam_domains", "questions", "answers", "explanations", "question_generation_runs",
  "user_subscriptions", "payment_history", "webhook_events", "pmle_passes", "pmle_pass_refunds",
  "study_sessions", "session_items", "free_practice_quota"];
const digestSQL = tables.map((table) => `SELECT '${table}', count(*), md5(coalesce(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text), '')) FROM public.${table} t;`).join("\n");
const baseline = readFileSync("supabase/migrations/20261003000000_v2_baseline.sql", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");
const before = await scalar(digestSQL);
await run(baseline);
assert.equal(await scalar(digestSQL), before, "second baseline apply must not change any rows");
await run(seed);
const seeded = await scalar(digestSQL);
await run(seed);
assert.equal(await scalar(digestSQL), seeded, "second seed apply must preserve rows");
assert.equal(await scalar("SELECT count(*) FROM public.questions WHERE source_ref LIKE 'local-educational-seed-%';"), "30");
assert.equal(await scalar("SELECT count(*) FROM (SELECT q.id FROM public.questions q JOIN public.answers a ON a.question_id=q.id WHERE q.source_ref LIKE 'local-educational-seed-%' GROUP BY q.id HAVING count(*)=4 AND count(*) FILTER (WHERE a.is_correct)=1 AND bool_and(length(a.explanation_text)>0)) s;"), "30");
assert.equal(await scalar("SELECT count(*) FROM (SELECT domain_id FROM public.questions WHERE source_ref LIKE 'local-educational-seed-%' GROUP BY domain_id HAVING count(*)=5) s;"), "6");
assert.equal(await scalar(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY[${tables.map(q).join(",")}]) AND c.relrowsecurity;`), String(tables.length));
for (const role of ["anon", "authenticated"]) {
  for (const table of ["questions", "answers", "explanations", "session_items", "webhook_events", "pmle_pass_refunds"]) {
    await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.${table}; ROLLBACK;`, `${role} must not read ${table}`);
  }
  for (const signature of ["create_study_session(text,uuid,text,jsonb,timestamptz)", "answer_study_item(uuid,uuid,text,uuid,text)", "consume_free_practice_quota(uuid,integer)", "fulfill_pmle_pass(uuid,text,text,text,timestamptz)", "refund_pmle_pass(text,timestamptz)", "v2_consume_free_practice_quota(uuid,integer)", "v2_create_study_session(text,uuid,text,jsonb,timestamptz,boolean)", "create_free_practice_session(uuid,jsonb,timestamptz)", "claim_anonymous_diagnostics(uuid,text)"]) {
    assert.equal(await scalar(`SELECT has_function_privilege('${role}', 'public.${signature}', 'EXECUTE');`), "f");
  }
}
console.log("PASS replay, seed inventory, table RLS and browser privilege denial");

const owner = randomUUID(), other = randomUUID(), paidOwner = randomUUID(), legacyOwner = randomUUID();
const strictOwner = randomUUID(), claimOwner = randomUUID(), claimOther = randomUUID();
const ownerIds = [owner, other, paidOwner, legacyOwner, strictOwner, claimOwner, claimOther];
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
  const questions = JSON.parse(await scalar(`SELECT json_agg(s) FROM (SELECT q.id AS question_id,d.code AS domain_code,d.name AS domain_name,q.stem FROM public.questions q JOIN public.exam_domains d ON d.id=q.domain_id WHERE q.source_ref LIKE 'local-educational-seed-%' ORDER BY q.id LIMIT 6) s;`));
  const items = questions.map((question) => ({ ...question,
    options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }], correct_label: "A" }));
  const createSQL = (kind, user, anonymous, snapshots) => `SELECT public.create_study_session(${q(kind)},${user ? q(user) : "NULL"},${anonymous ? q(anonymous) : "NULL"},${q(JSON.stringify(snapshots))}::jsonb,now()+interval '1 hour')`;
  const strictSQL = (user, snapshots) => `SELECT public.create_free_practice_session(${q(user)},${q(JSON.stringify(snapshots))}::jsonb,now()+interval '1 hour')`;
  const claimSQL = (user, digest) => `SELECT public.claim_anonymous_diagnostics(${user ? q(user) : "NULL"},${digest === null ? "NULL" : q(digest)})`;
  sessionId = await scalar(service(createSQL("diagnostic", null, hash, items.slice(0, 2))));
  const rows = JSON.parse(await scalar(`SELECT json_agg(s ORDER BY ordinal) FROM (SELECT id,ordinal FROM public.session_items WHERE session_id=${q(sessionId)}) s;`));
  const answerSQL = (id, label, user = null, anonymous = hash) => `SELECT public.answer_study_item(${q(sessionId)},${q(id)},${q(label)},${user ? q(user) : "NULL"},${anonymous ? q(anonymous) : "NULL"})`;
  await denied(service(answerSQL(rows[0].id, "A", other, null)), "foreign user cannot answer anonymous session");
  await denied(service(answerSQL(rows[0].id, "A", null, "0".repeat(64))), "wrong anonymous owner denied");
  await denied(service(answerSQL(rows[1].id, "A")), "out of order answer denied");
  await denied(service(answerSQL(rows[0].id, "C")), "unknown option denied");
  const first = JSON.parse(await scalar(service(answerSQL(rows[0].id, "B"))));
  assert.deepEqual(first, { answeredCount: 1, totalQuestions: 2, completed: false });
  assert.deepEqual(JSON.parse(await scalar(service(answerSQL(rows[0].id, "B")))), first, "same answer retry idempotent");
  await denied(service(answerSQL(rows[0].id, "A")), "changed answer rejected");
  assert.deepEqual(JSON.parse(await scalar(service(answerSQL(rows[1].id, "A")))), { answeredCount: 2, totalQuestions: 2, completed: true });
  assert.equal(await scalar(`SELECT count(*) FROM public.session_items WHERE session_id=${q(sessionId)} AND is_correct;`), "1");
  assert.equal(await scalar(`SELECT completed_at IS NOT NULL FROM public.study_sessions WHERE id=${q(sessionId)};`), "t");
  // Expiry checked independently of item state.
  await run(`UPDATE public.study_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE id=${q(sessionId)};`);
  await denied(service(answerSQL(rows[0].id, "B")), "expired session denied");
  console.log("PASS anonymous ownership, next ordinal, options, retry, server correctness, completion, expiry");

  // Real concurrent session-creation transactions contend on the same quota row.
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => run(service(createSQL("practice", owner, null, items.slice(0, 1))), true)));
  assert.equal(concurrent.filter((result) => result.code === 0).length, 5, "only five concurrent free one-question sessions succeed");
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(owner)};`), "5");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(owner)};`), "5");
  const invalidItem = { ...items[0], question_id: randomUUID() };
  await denied(service(createSQL("practice", other, null, [invalidItem])), "failed insert rolls back quota");
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)};`), "0");
  await denied(service(createSQL("practice", other, null, items)), "six questions exceed free quota");
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)};`), "0");
  // Phase 2 uses the explicit free-only RPC: eight five-question requests charge exactly once.
  const strictConcurrent = await Promise.all(Array.from({ length: 8 }, () => run(service(strictSQL(strictOwner, items.slice(0, 5))), true)));
  assert.equal(strictConcurrent.filter((result) => result.code === 0).length, 1, "one five-question free-only request wins");
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(strictOwner)};`), "5");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(strictOwner)} AND kind='practice';`), "1");
  assert.equal(await scalar(`SELECT count(*) FROM public.session_items i JOIN public.study_sessions s ON s.id=i.session_id WHERE s.user_id=${q(strictOwner)};`), "5");
  await denied(service(strictSQL(other, [invalidItem])), "strict snapshot FK failure rolls back charge");
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(other)};`), "0");
  assert.equal(await scalar(`SELECT count(*) FROM public.study_sessions WHERE user_id=${q(other)};`), "0");
  await denied(service(strictSQL(other, items)), "strict path refuses more than five questions");
  console.log("PASS Phase 2 strict eight-way five-question creation, exact single charge and snapshot FK rollback");

  // Claims attach every diagnostic for the cookie, including completed/expired rows, once only.
  const claimSessions = await Promise.all(Array.from({ length: 3 }, () => scalar(service(createSQL("diagnostic", null, claimHash, items.slice(0, 1))))));
  const foreignSession = await scalar(service(createSQL("diagnostic", null, foreignHash, items.slice(0, 1))));
  const completedClaimItem = await scalar(`SELECT id FROM public.session_items WHERE session_id=${q(claimSessions[1])};`);
  await run(service(`SELECT public.answer_study_item(${q(claimSessions[1])},${q(completedClaimItem)},'A',NULL,${q(claimHash)})`));
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
  const claimAnswer = (user, digest) => `SELECT public.answer_study_item(${q(claimSessions[0])},${q(claimedItem)},'A',${user ? q(user) : "NULL"},${digest ? q(digest) : "NULL"})`;
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
  await run(service(createSQL("practice", paidOwner, null, items)));
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(paidOwner)};`), "0", "valid pass bypasses free counter");
  await run(service(strictSQL(paidOwner, items.slice(0, 5))));
  assert.equal(await scalar(`SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(paidOwner)};`), "5", "Phase 2 charges valid pass holder");
  await denied(service(strictSQL(paidOwner, items.slice(0, 1))), "valid pass cannot bypass Phase 2 exhaustion");
  await run(service(`SELECT public.refund_pmle_pass(${q(intentAfter)},now())`));
  await denied(service(createSQL("practice", paidOwner, null, items)), "refund-after-fulfillment revokes unlimited practice");
  await run(`INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status,current_period_end) VALUES (${q(legacyOwner)},${q("local-legacy-" + randomUUID())},'active',NULL);`);
  await run(service(createSQL("practice", legacyOwner, null, items)));
  assert.equal(await scalar(`SELECT count(*) FROM public.free_practice_quota WHERE user_id=${q(legacyOwner)};`), "0", "legacy active subscription bypasses quota");
  await run(service(strictSQL(legacyOwner, items.slice(0, 5))));
  await denied(service(strictSQL(legacyOwner, items.slice(0, 1))), "legacy active cannot bypass strict Phase 2 exhaustion");
  await denied(service(strictSQL(paidOwner, items.slice(0, 1))), "refunded pass cannot bypass strict Phase 2 exhaustion");
  await run(`UPDATE public.pmle_passes SET paid_at=now()-interval '2 days',expires_at=now()-interval '1 day',refunded_at=NULL WHERE id=${q(validPassId)};`);
  await denied(service(strictSQL(paidOwner, items.slice(0, 1))), "expired pass cannot bypass strict Phase 2 exhaustion");
  console.log("PASS Phase 2 valid/refunded/expired pass and legacy strict exhaustion");
  console.log("PASS refund-before/after fulfillment, duplicate identity, 2160-hour expiry, paid/legacy practice access");
} finally {
  // Only isolated generated owners/anonymous hash and fake payment intents are removed.
  await run(`DELETE FROM public.study_sessions WHERE anonymous_owner_hash IN (${q(hash)},${q(claimHash)},${q(foreignHash)});
    DELETE FROM public.pmle_pass_refunds WHERE stripe_payment_intent_id IN (${q(intent)},${q(intentAfter)});
    DELETE FROM auth.users WHERE id IN (${ownerIds.map(q).join(",")});`);
}
console.log("PASS all local DB integration checks; isolated fixtures removed");
