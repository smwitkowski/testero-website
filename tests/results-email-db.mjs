/** Local-only transactional results email permissions and concurrency checks.
 * Run: node scripts/local.mjs verify-results-email-db. Removes only its isolated test session and cascading email rows.
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

const q = text => "'" + text.replaceAll("'", "''") + "'";
const session = randomUUID(); const email = `results-${randomUUID()}@example.test`;
const claim = () => run(`SET ROLE service_role; SELECT public.claim_results_email('${session}',${q(email)},'frozen payload','${randomUUID()}');`);
try {
 await run(`INSERT INTO public.study_sessions(id,kind,anonymous_owner_hash,question_count,domain_codes,expires_at,completed_at) VALUES('${session}','diagnostic',repeat('a',64),20,ARRAY['domain'],now()+interval '1 day',now())`);
 assert.equal((await run("SELECT relrowsecurity FROM pg_class WHERE oid='public.results_email_requests'::regclass")).output,"t");
 for (const role of ['anon','authenticated']) {
  for (const sql of ["SELECT * FROM public.results_email_requests",`INSERT INTO public.results_email_requests(session_id,email,consent,payload) VALUES('${session}',${q(email)},true,'x')`,"UPDATE public.results_email_requests SET payload='x'","DELETE FROM public.results_email_requests",`SELECT public.claim_results_email('${session}',${q(email)},'x','${randomUUID()}')`]) {
   const result = await run(`BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`,true);
   assert.notEqual(result.code,0); assert.match(result.error,/permission denied|row-level security/);
  }
 }
 const claims = await Promise.all([claim(),claim(),claim()]);
 const data = claims.map(r=>JSON.parse(r.output));
 assert.equal(data.filter(r=>r.status==='claimed').length,1);
 assert.equal(data.filter(r=>r.status==='busy').length,2);
 const id=data.find(r=>r.status==='claimed').id;
 await run(`UPDATE public.results_email_requests SET lease_until=now()-interval '1 minute' WHERE id='${id}'`);
 const retry=JSON.parse((await claim()).output); assert.equal(retry.id,id); assert.equal(retry.payload,'frozen payload');
 await run(`UPDATE public.results_email_requests SET sent_at=now() WHERE id='${id}'`);
 assert.equal(JSON.parse((await claim()).output).status,'sent');
 await run(`UPDATE public.results_email_requests SET sent_at=null,created_at=now()-interval '24 hours',lease_until=null WHERE id='${id}'`);
 assert.equal(JSON.parse((await claim()).output).status,'expired');
 console.log('PASS results email RLS/CRUD+RPC denial; concurrent claims=1; frozen retry; sent dedupe; expiry');
} finally { await run(`DELETE FROM public.study_sessions WHERE id='${session}'`); }
