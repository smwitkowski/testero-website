import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function denied(args: string[]) {
  const result = spawnSync(process.execPath, ["scripts/verify-prod-schema.mjs", ...args], {
    cwd: process.cwd(), encoding: "utf8", timeout: 5000,
  });
  expect(result.status).not.toBe(0);
  return result.stderr;
}

describe("local production-schema verifier admission", () => {
  it("requires an explicit destructive local restore acknowledgement", () => {
    expect(denied([])).toContain("Require --restore-local");
  });
  it("accepts no database URL or remote-target argument", () => {
    expect(denied(["--database-url", "https://invalid.example"])).toContain("accepts no remote URL");
  });
  it("rejects unapproved backup directories before inspecting a file", () => {
    expect(denied(["--restore-local", "--schema", "/does-not-exist/schema.sql"]))
      .toContain("Only the explicitly approved backup directory is permitted");
  });
  it.each(["data.sql", "roles.sql", "anything.sql"])("rejects %s before opening or statting it", name => {
    expect(denied(["--restore-local", "--schema", `/does-not-exist/${name}`]))
      .toContain("Only approved backup filenames are permitted");
  });
});
