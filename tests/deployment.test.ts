import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const deploy = read(".github/workflows/deploy-to-cloud-run.yml");
const keepAlive = read(".github/workflows/keep-alive.yml");
const docker = read("Dockerfile");

// Configuration checks only. Never invoke cloud, payment, or production services.
describe("non-destructive deployment configuration", () => {
  it("checks pull requests but builds and deploys images only on main pushes", () => {
    expect(deploy).toContain("branches: [main]");
    for (const command of ["npm run lint", "npm run typecheck", "npm test", "npm run build"])
      expect(deploy).toContain(command);
    expect(deploy.match(/if: github.ref == 'refs\/heads\/main' && github.event_name == 'push'/g)).toHaveLength(2);
  });
  it("merges env and secret bindings rather than wiping unrelated runtime values", () => {
    expect(deploy).toContain("env_vars_update_strategy: merge");
    expect(deploy).toContain("secrets_update_strategy: merge");
    expect(deploy).not.toContain("--set-env-vars");
    expect(deploy).not.toContain("env_vars_file:");
    for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
      expect(deploy).toContain(`${name}=\${{ secrets.${name}_SECRET }}`);
      expect(deploy).not.toContain(`\${{ secrets.${name} }}`);
      expect(docker).not.toContain(`ARG ${name}`);
    }
  });
  it("uses a non-root standalone runner with markdown runtime assets", () => {
    expect(docker).toContain("/app/.next/standalone ./");
    expect(docker).toContain("/app/.next/static ./.next/static");
    expect(docker).toContain("/app/content ./content");
    expect(docker).toContain("USER nextjs");
    expect(docker).toContain('CMD ["node", "server.js"]');
    const ignored = read(".dockerignore").split(/\r?\n/);
    expect(ignored).toContain("content-pipeline");
    expect(ignored).not.toContain("content");
  });
  it("defines exactly the eight supported application configuration values", () => {
    const names = read(".env.example").split(/\r?\n/)
      .filter(line => /^[A-Z][A-Z_0-9]*=/.test(line)).map(line => line.split("=")[0]).sort();
    expect(names).toEqual([
      "NEXT_PUBLIC_POSTHOG_HOST", "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL",
      "STRIPE_PRICE_PMLE_PASS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });
});

describe("scheduled database readiness check", () => {
  it("runs daily and manually with bounded timeout and loud failures", () => {
    expect(keepAlive).toContain('cron: "17 8 * * *"');
    expect(keepAlive).toContain("workflow_dispatch:");
    expect(keepAlive).toContain("timeout-minutes: 2");
    expect(keepAlive).toContain("vars.PRODUCTION_URL || secrets.PRODUCTION_URL");
    expect(keepAlive).toContain('origin + "/api/health"');
    expect(keepAlive).toContain("timeout=20");
    expect(keepAlive).toContain("response.status != 200");
    expect(keepAlive).toContain('set(payload) != {"ok"} or payload["ok"] is not True');
    expect(keepAlive).toContain("NoRedirect");
    expect(keepAlive).not.toMatch(/\|\|\s*true|continue-on-error|except\s*:/);
  });
});
