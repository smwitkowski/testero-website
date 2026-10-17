/** Local-only question-report permissions, ownership and concurrent quota verifier.
 * Run only with coordinator lease: node scripts/local.mjs verify-report-db.
 * Does not apply migrations, reset history or edit the question bank.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

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


const q = text => "'" + String(text).replaceAll("'", "''") + "'";
const sessionId = randomUUID(), otherSession = randomUUID(), itemId = randomUUID(), otherItem = randomUUID();
const hash = randomUUID().replaceAll("-", "").repeat(2);
const service = sql => `BEGIN; SET LOCAL ROLE service_role; ${sql}; COMMIT;`;
const call = (session = sessionId, item = itemId, ownerHash = hash, kind = "diagnostic") =>
  `SELECT public.submit_question_report(${q(session)},${q(item)},${q(kind)},NULL,${q(ownerHash)},'typo','Verifier note','')`;
async function denied(sql, pattern) {
  const result = await run(sql, true);
  assert.notEqual(result.code, 0);
  assert.match(result.error, pattern);
}
try {
  assert.equal((await run("SELECT relrowsecurity FROM pg_class WHERE oid='public.question_reports'::regclass")).output, "t");
  assert.equal((await run("SELECT count(*) FROM pg_policies WHERE tablename='question_reports' AND schemaname='public'")).output, "0");
  // Copy only one bank reference into isolated snapshots; never modify bank content.
  const questionId = (await run("SELECT id FROM public.questions ORDER BY id LIMIT 1")).output;
  assert.match(questionId, /^[0-9a-f-]{36}$/);
  for (const id of [sessionId,otherSession]) await run(`INSERT INTO public.study_sessions(id,kind,anonymous_owner_hash,question_count,domain_codes,expires_at) VALUES(${q(id)},'diagnostic',${q(hash)},1,ARRAY['REPORT_VERIFIER'],now()+interval '1 hour')`);
  for (const [item,session] of [[itemId,sessionId],[otherItem,otherSession]]) await run(`INSERT INTO public.session_items(id,session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label) VALUES(${q(item)},${q(session)},1,${q(questionId)},'REPORT_VERIFIER','Verifier','Verifier snapshot','[{"label":"A","text":"One"},{"label":"B","text":"Two"}]'::jsonb,'A')`);
  for (const role of ["anon","authenticated"]) {
    for (const sql of ["SELECT * FROM public.question_reports",`INSERT INTO public.question_reports(session_id,item_id,question_id,owner_key,reason) VALUES(${q(sessionId)},${q(itemId)},${q(questionId)},'forged','typo')`,`UPDATE public.question_reports SET note='forged' WHERE session_id=${q(sessionId)}`,`DELETE FROM public.question_reports WHERE session_id=${q(sessionId)}`,call()]) {
      await denied(`BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`,/permission denied|row-level security/);
    }
  }
  await denied(service(call(sessionId,itemId,"b".repeat(64))),/Question not found/);
  await denied(service(call(sessionId,otherItem)),/Question not found/);
  await denied(service(call(sessionId,itemId,hash,"practice")),/Question not found/);
  await run(service(call()));
  assert.equal((await run(`SELECT question_id||'|'||item_id||'|'||owner_key FROM public.question_reports WHERE session_id=${q(sessionId)}`)).output,`${questionId}|${itemId}|anon:${hash}`);
  // Concurrent calls use separate connections/transactions. Only nine more may commit.
  const results = await Promise.all(Array.from({length:15},()=>run(service(call()),true)));
  assert.equal(results.filter(result=>result.code===0).length,9);
  for (const result of results.filter(result=>result.code!==0)) assert.match(result.error,/Report limit exceeded/);
  assert.equal((await run(`SELECT count(*) FROM public.question_reports WHERE owner_key=${q('anon:'+hash)}`)).output,"10");
  await denied(service(call(otherSession,otherItem)),/Report limit exceeded/);
  console.log("PASS question_reports: RLS/no browser policies; anon/auth CRUD+RPC denied; owner/kind/membership denial; internal bank resolution; concurrent durable 10/hour per-owner cap across sessions");
} finally {
  await run(`DELETE FROM public.question_reports WHERE session_id IN (${q(sessionId)},${q(otherSession)}); DELETE FROM public.study_sessions WHERE id IN (${q(sessionId)},${q(otherSession)});`);
}
