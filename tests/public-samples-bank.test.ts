import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { getPublicSamples } from "@/lib/public-samples/loader";

// Read-only, all-status check. Never use hosted DB configuration from the shell.
describe("public sample bank isolation", () => {
  it("has no ID collisions with the available local DB bank", async context => {
    let local: { API_URL: string; SERVICE_ROLE_KEY: string };
    try {
      const { stdout } = await promisify(execFile)("supabase", ["status", "-o", "json"], { timeout: 20_000 });
      local = JSON.parse(stdout);
    } catch { context.skip(true, "Local Supabase is not available"); return; }
    const url = new URL(local.API_URL);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port !== "56541" || url.pathname !== "/" || url.search || url.username || url.password) throw new Error("Expected isolated local Supabase endpoint");
    const ids = getPublicSamples().map(question => question.id);
    // Probe the table even when the publication file is intentionally empty.
    const query = ids.length ? `select=id&id=in.(${ids.join(",")})` : "select=id&limit=0";
    let response: Response;
    try {
      response = await fetch(`${url.origin}/rest/v1/questions?${query}`, { redirect: "error", headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` } });
    } catch { context.skip(true, "Local DB is not reachable"); return; }
    if (!response.ok) throw new Error("Local bank ID check failed");
    expect(await response.json()).toEqual([]);
  }, 30_000);
});
