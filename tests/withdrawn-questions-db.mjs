/** Local-only migration C verifier. No migration/reset/remote endpoint support.
 * DATABASE_URL=<local URL> node tests/withdrawn-questions-db.mjs
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["postgres:","postgresql:"].includes(url.protocol) || !["localhost","127.0.0.1","[::1]"].includes(url.hostname)
 || url.port !== "56542" || url.pathname !== "/postgres" || url.search) throw new Error("Only local PostgreSQL port56542/postgres is permitted");
const env = { ...process.env, PGHOST: url.hostname.replace(/[\[\]]/g,""), PGPORT: url.port, PGDATABASE: "postgres",
 PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "disable" };
for (const key of ["PGSERVICE","PGSERVICEFILE","PGHOSTADDR","PGOPTIONS","PGPASSFILE"]) delete env[key];
const child = spawn("psql",["-X","-q","-v","ON_ERROR_STOP=1"],{ env, stdio: ["pipe","inherit","inherit"] });
child.stdin.end(readFileSync(new URL("./sql/withdrawn-session-questions.sql",import.meta.url),"utf8"));
child.on("error", () => { console.error("Could not run local psql verifier"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; if (code === 0) console.log("PASS withdrawn study answers, mock exclusion, history and permissions (rolled back)"); });
