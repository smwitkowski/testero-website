import { defineConfig, devices } from "@playwright/test";

// MCP-only QA uses its own loopback port; never reuse another worktree's dev server.
const mcpSmoke = process.env.TESTERO_QA === "1" && process.env.TESTERO_QA_MCP === "1";
const baseURL = `http://127.0.0.1:${mcpSmoke ? 3107 : 3000}`;
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseURL) {
  const url = new URL(supabaseURL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Playwright requires a loopback-only local Supabase URL.");
  }
}

export default defineConfig({
  testDir: "./e2e",
  ...(process.env.TESTERO_QA === "1" ? { testMatch: mcpSmoke ? "chatgpt-mcp.spec.ts" : process.env.CODEX_CAPTURE === "1" ? "ui-audit-codex.spec.ts" : "qa-core.spec.ts" } : { testIgnore: "qa-core.spec.ts" }),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: process.env.TESTERO_QA === "1" ? (mcpSmoke ? [1280] : [1280, 375]).map(width => ({ name: `qa-${width}`, use: { ...devices["Desktop Chrome"], viewport: { width, height: 900 } } })) : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_MANAGED_SERVER === "1" ? undefined : {
    command: mcpSmoke ? "npm run dev -- --port 3107" : "npm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_PUBLIC_POSTHOG_HOST: "",
    },
  },
});
