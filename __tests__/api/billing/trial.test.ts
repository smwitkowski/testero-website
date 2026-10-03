/** @jest-environment node */
import { existsSync } from "fs";
import { join } from "path";
import { computeIsSubscriber } from "@/lib/billing/subscription-status";

describe("trial retirement", () => {
  it("removes the trial creation endpoint rather than exposing free access", () => {
    expect(existsSync(join(process.cwd(), "app/api/billing/trial/route.ts"))).toBe(false);
  });
  it("does not grant paid access for trialing status", () => {
    expect(computeIsSubscriber({ status: "trialing" })).toBe(false);
  });
  it("preserves active legacy status", () => {
    expect(computeIsSubscriber({ status: "active" })).toBe(true);
  });
  it.each([
    "none",
    "canceled",
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const)("does not grant access for %s status", (status) => {
    expect(computeIsSubscriber({ status })).toBe(false);
  });
  it("does not grant access for missing metadata", () => {
    expect(computeIsSubscriber(null)).toBe(false);
  });
});
