import { getPassAnalyticsProperties } from "@/lib/pricing/price-utils";
import { PMLE_PASS } from "@/lib/pricing/constants";

describe("PMLE Pass pricing and analytics", () => {
  it("defines a single US$39 pass with 90-day access and 7-day refund window", () => {
    expect(PMLE_PASS).toEqual({ name: "PMLE Pass", price: 39, durationDays: 90, refundDays: 7 });
  });
  it("tracks the exact offer name and one-time payment mode", () => {
    expect(getPassAnalyticsProperties()).toEqual({
      plan_name: "PMLE Pass", payment_mode: "payment", plan_type: "pass", price: 39, currency: "USD", duration_days: 90,
    });
  });
  it("does not expose client price IDs or recurring billing properties", () => {
    const properties = getPassAnalyticsProperties();
    expect(properties).not.toHaveProperty("price_id");
    expect(properties).not.toHaveProperty("billing_interval");
    expect(PMLE_PASS).not.toHaveProperty("monthlyPriceId");
  });
  it("returns fresh analytics properties for callers", () => {
    expect(getPassAnalyticsProperties()).not.toBe(getPassAnalyticsProperties());
  });
});
