import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { mirrorBank } from "./mirror-bank.mjs";
import { seedAccounts } from "./seed-accounts.mjs";
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", () => reject(new Error("Could not start local QA command")));
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Local QA command exited ${code}`)));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
  });
}
const started = new Date().toISOString();
const mcpSmoke = process.argv.includes("--mcp-smoke");
let passed = false;
for (const width of [1280, 375]) await rm(`.qa/timings-qa-${width}.json`, { force: true });
try {
  await promisify(execFile)("supabase", ["start"], { maxBuffer: 4_000_000 });
  console.log("Local Supabase ready (CLI credential output suppressed).");
  await promisify(execFile)("supabase", ["migration", "up", "--local"], { maxBuffer: 4_000_000 });
  console.log("Local migrations current (no reset).");
  await mirrorBank(process.argv.includes("--refresh"));
  await seedAccounts();
  await run("node", ["scripts/local.mjs", "e2e"], { ...process.env, TESTERO_QA: "1", TESTERO_QA_MCP: mcpSmoke ? "1" : "" });
  passed = true;
} catch { console.error("Local QA failed; inspect the failing gate above. Cloud credential errors are suppressed."); process.exitCode = 1; }
await mkdir(".qa", { recursive: true, mode: 0o700 });
let inventory;
try {
  const bank = JSON.parse(await readFile(".qa/bank.json", "utf8"));
  inventory = { exportedAt: bank.exportedAt, questions: bank.questions.length, answers: bank.answers.length, explanations: bank.explanations.length, domains: bank.exam_domains.length };
} catch { /* Mirror gate failed before inventory was available. */ }
const timings = [];
for (const width of [1280, 375]) {
  try { timings.push(JSON.parse(await readFile(`.qa/timings-qa-${width}.json`, "utf8"))); } catch { /* Failed scenarios have no completed timing artifact. */ }
}
await writeFile(".qa/report.json", JSON.stringify({ started, finished: new Date().toISOString(), passed, inventory, timings, stripe: "local fake transport only", productionWrites: false }, null, 2), { mode: 0o600 });
console.log(`Local QA ${passed ? "PASS" : "FAIL"}; report .qa/report.json; traces and timings in test-results.`);
