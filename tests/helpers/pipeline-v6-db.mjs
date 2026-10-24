/** Pipeline v6 local-only SQL harness. No reset, env-file reads, or remote URLs. */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

if (!/project_id\s*=\s*"testero-v2"/.test(readFileSync("supabase/config.toml", "utf8")))
  throw new Error("Expected isolated testero-v2 project");
let urlText = process.env.DATABASE_URL;
if (!urlText) {
  const { stdout } = await promisify(execFile)("supabase", ["status", "-o", "json"]);
  urlText = JSON.parse(stdout).DB_URL;
}
const url = new URL(urlText);
if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "56542" || url.pathname !== "/postgres" || url.search || url.hash)
  throw new Error("Only local testero-v2 port 56542/database postgres is permitted");
const env = { ...process.env, PGHOST: url.hostname.replace(/[\[\]]/g, ""), PGPORT: url.port,
  PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "disable" };
for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGOPTIONS", "PGPASSFILE"]) delete env[key];
export function run(sql, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", part => { output += part; });
    child.stderr.on("data", part => { error += part; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0 && !allowFailure) reject(new Error(`Local SQL failed: ${error}`));
      else resolve({ code, output: output.trim(), error });
    });
    child.stdin.end(sql);
  });
}
export const q = text => "'" + String(text).replaceAll("'", "''") + "'";
export const scalar = async sql => (await run(sql)).output;
export const service = sql => `BEGIN; SET LOCAL ROLE service_role; ${sql}; COMMIT;`;
export async function denied(sql, pattern) {
  const result = await run(sql, true);
  assert.notEqual(result.code, 0);
  assert.match(result.error, pattern);
}
