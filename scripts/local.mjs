import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, readdirSync } from "node:fs";
import { LOCAL_STRIPE_ENV, startStripeFixtureServer } from "./stripe-fixture.mjs";
const execute = promisify(execFile);
const commands = { dev: ["npm", ["run", "dev"]], e2e: ["npm", ["run", "test:e2e"]], "verify-db": ["node", ["tests/schema-db-integration.mjs"]] };
const requested = process.argv[2];
const prodCommand = ["e2e:prod", "verify-db:prod"].includes(requested);
const name = prodCommand ? requested.replace(":prod", "") : requested;
const command = commands[name];
if (!command || process.argv.length !== 3) throw new Error("Usage: node scripts/local.mjs dev|e2e|verify-db|e2e:prod|verify-db:prod");
if (process.env.TESTERO_PROD_SCHEMA && process.env.TESTERO_PROD_SCHEMA !== "1") throw new Error("TESTERO_PROD_SCHEMA must be 1 or unset");
const prodSchema = prodCommand || process.env.TESTERO_PROD_SCHEMA === "1";
if (!/project_id\s*=\s*"testero-v2"/.test(readFileSync("supabase/config.toml", "utf8"))) throw new Error("Expected the isolated testero-v2 local project");
if (readdirSync(".").some(name => name.startsWith(".env") && name !== ".env.example")) throw new Error("Local runner refuses credential env files; use the local CLI-generated process environment");
try {
  const { stdout } = await execute("supabase", ["status", "-o", "json"]);
  const status = JSON.parse(stdout);
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  const loopback = url => ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!loopback(api) || api.protocol !== "http:" || api.port !== "56541" || api.search || !loopback(db) || !["postgres:", "postgresql:"].includes(db.protocol) || db.port !== "56542" || db.pathname !== "/postgres" || db.search) throw new Error("Unexpected local endpoints");
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("Local API keys are unavailable");
  const fixture = name === "verify-db" ? null : await startStripeFixtureServer();
  const env = { ...process.env, ...LOCAL_STRIPE_ENV, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, DATABASE_URL: status.DB_URL, NEXT_PUBLIC_POSTHOG_KEY: "", NEXT_PUBLIC_POSTHOG_HOST: "", NEXT_TELEMETRY_DISABLED: "1" };
  if (prodSchema) env.TESTERO_PROD_SCHEMA = "1";
  else delete env.TESTERO_PROD_SCHEMA;
  const child = spawn(command[0], command[1], { stdio: "inherit", env });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", async (code, signal) => { await fixture?.close(); process.exitCode = code ?? (signal ? 1 : 0); });
  child.on("error", async () => { await fixture?.close(); console.error("Could not start the local command"); process.exitCode = 1; });
} catch {
  console.error("Local setup failed. Run supabase start in this project, then retry. No remote endpoint is allowed.");
  process.exitCode = 1;
}
