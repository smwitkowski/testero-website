/** Local-only certification waitlist permissions and duplicate checks.
 * Run: node scripts/local.mjs verify-cert-db. Removes only its isolated test row.
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
const email = `cert-hub-db-${randomUUID()}@example.test`;
try {
  assert.equal((await run("SELECT relrowsecurity FROM pg_class WHERE oid='public.cert_waitlist'::regclass")).output, "t");
  assert.equal((await run("SELECT count(*) FROM pg_policies WHERE tablename='cert_waitlist' AND schemaname='public'")).output, "0");
  for (const role of ["anon", "authenticated"]) {
    for (const sql of ["SELECT id FROM public.cert_waitlist", `INSERT INTO public.cert_waitlist(email,cert_id) VALUES (${q(email)},'cloud-engineer')`, `UPDATE public.cert_waitlist SET cert_id='cloud-developer' WHERE email=${q(email)}`, `DELETE FROM public.cert_waitlist WHERE email=${q(email)}`]) {
      const result = await run(`BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`, true);
      assert.notEqual(result.code, 0); assert.match(result.error, /permission denied|row-level security/);
    }
  }
  const insert = `SET ROLE service_role; INSERT INTO public.cert_waitlist(email,cert_id) VALUES (${q(email)},'cloud-engineer') ON CONFLICT (email,cert_id) DO NOTHING;`;
  await Promise.all([run(insert), run(insert), run(insert)]);
  const original = (await run(`SELECT id || '|' || created_at FROM public.cert_waitlist WHERE email=${q(email)}`)).output;
  await run(insert);
  assert.equal((await run(`SELECT id || '|' || created_at FROM public.cert_waitlist WHERE email=${q(email)}`)).output, original);
  assert.equal((await run(`SELECT count(*) FROM public.cert_waitlist WHERE email=${q(email)}`)).output, "1");
  const invalid = await run(`INSERT INTO public.cert_waitlist(email,cert_id) VALUES ('UPPER@EXAMPLE.TEST','cloud-engineer')`, true);
  assert.notEqual(invalid.code, 0); assert.match(invalid.error, /check constraint/);
  console.log("PASS cert_waitlist RLS enabled/no policies; anon+authenticated CRUD denied; service insert; concurrent duplicates=1 unchanged id/date; lowercase check");
} finally { await run(`DELETE FROM public.cert_waitlist WHERE email=${q(email)}`); }
