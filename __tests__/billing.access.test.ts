/** @jest-environment node */
import fs from "fs";
import path from "path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("single PMLE paid-access boundary", () => {
  it.each([
    "lib/billing/access.ts",
    "lib/config/billing.ts",
    "lib/billing/enforcement.ts",
    "lib/billing/gated-layout.ts",
    "app/api/billing/trial/route.ts",
    "components/billing/TrialConversionModal.tsx",
  ])("removes the retired gate or trial implementation %s", (file) => {
    expect(fs.existsSync(path.join(process.cwd(), file))).toBe(false);
  });

  it.each(["lib/auth/entitlements.ts", "lib/billing/is-subscriber.ts"])(
    "uses the same paid-access implementation in %s", (file) => {
      expect(source(file)).toContain("paid-access");
      expect(source(file)).not.toContain('.from("user_subscriptions")');
      expect(source(file)).not.toContain("trialing");
    }
  );

  it("has no flag or grace-cookie access bypass in the API gate", () => {
    const gate = source("lib/auth/require-subscriber.ts");
    expect(gate).not.toContain("BILLING_ENFORCEMENT");
    expect(gate).not.toContain("isBillingEnforcementActive");
    expect(gate).not.toContain("verifyGraceCookie");
    expect(gate).toContain("canUseFeature");
  });
});
