import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { resetTestEnvironment, TEST_ENV_KEYS } from "./test-environment";

describe("hermetic unit environment", () => {
  it("starts with no inherited application settings or local-runner flags", () => {
    for (const key of TEST_ENV_KEYS) expect(process.env[key], key).toBeUndefined();
    expect(process.env.NODE_ENV).toBe("test");
  });
  it("removes hostile caller settings without enabling a fixture bypass", () => {
    for (const key of TEST_ENV_KEYS) vi.stubEnv(key, "ambient-placeholder");
    vi.stubEnv("NODE_ENV", "production");
    resetTestEnvironment();
    for (const key of TEST_ENV_KEYS) expect(process.env[key], key).toBeUndefined();
    expect(process.env.NODE_ENV).toBe("test");
  });
  it("covers every documented application configuration name", () => {
    const names = readFileSync(".env.example", "utf8").split(/\r?\n/)
      .filter(line => /^[A-Z][A-Z_0-9]*=/.test(line)).map(line => line.split("=")[0]);
    for (const name of names) expect(TEST_ENV_KEYS).toContain(name);
  });
});
