/** All local DB safety gates. Child scripts independently enforce loopback-only URLs. */
import { spawn } from "node:child_process";
for (const file of ["tests/schema-db-integration.mjs", "tests/pipeline-v6-publication-db.mjs",
  "tests/pipeline-v6-report-quarantine-db.mjs", "tests/withdrawn-questions-db.mjs"]) {
  const code = await new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[file],{env:process.env,stdio:"inherit"});
    child.once("error",reject);
    child.once("close",code => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
