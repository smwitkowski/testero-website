/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/portal/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { StripeService } from "@/lib/stripe/stripe-service";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock("@/lib/auth/rate-limiter", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/lib/stripe/stripe-service", () => ({ StripeService: jest.fn() }));
jest.mock("@/lib/analytics/analytics", () => ({
  ANALYTICS_EVENTS: { BILLING_PORTAL_ACCESSED: "portal" },
  trackEvent: jest.fn(),
}));
jest.mock("@/lib/analytics/server-analytics", () => ({ getServerPostHog: jest.fn() }));

describe("legacy-only billing portal", () => {
  let db: any;
  let portal: jest.Mock;
  const request = () =>
    new NextRequest("http://localhost:3000/api/billing/portal", { method: "POST" });
  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(db);
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    portal = jest.fn().mockResolvedValue({ url: "https://billing.example.test/session" });
    (StripeService as jest.Mock).mockImplementation(() => ({ createPortalSession: portal }));
  });
  it("denies a pass-only customer", async () => {
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(StripeService).not.toHaveBeenCalled();
    expect(db.from).toHaveBeenCalledWith("user_subscriptions");
    expect(db.not).toHaveBeenCalledWith("stripe_subscription_id", "is", null);
  });
  it("defensively denies a customer record without a legacy subscription", async () => {
    db.maybeSingle.mockResolvedValue({
      data: { stripe_customer_id: "cus_pass", stripe_subscription_id: null },
      error: null,
    });
    expect((await POST(request())).status).toBe(404);
    expect(StripeService).not.toHaveBeenCalled();
  });
  it.each(["active", "past_due", "canceled"])(
    "permits existing %s legacy billing management",
    async (status) => {
      db.maybeSingle.mockResolvedValue({
        data: { status, stripe_customer_id: "cus_legacy", stripe_subscription_id: "sub_legacy" },
        error: null,
      });
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ url: "https://billing.example.test/session" });
      expect(portal).toHaveBeenCalledWith("cus_legacy", "http://localhost:3000/dashboard/billing");
    }
  );
  it("rejects unauthenticated requests", async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(StripeService).not.toHaveBeenCalled();
  });
  it("retains rate limiting", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });
  it("fails closed on a DB error", async () => {
    db.maybeSingle.mockResolvedValue({
      data: { stripe_customer_id: "cus_legacy", stripe_subscription_id: "sub_legacy" },
      error: new Error("DB"),
    });
    expect((await POST(request())).status).toBe(404);
    expect(portal).not.toHaveBeenCalled();
  });
  it("returns an error on portal service failure", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    db.maybeSingle.mockResolvedValue({
      data: { stripe_customer_id: "cus_legacy", stripe_subscription_id: "sub_legacy" },
      error: null,
    });
    portal.mockRejectedValue(new Error("mock Stripe failure"));
    expect((await POST(request())).status).toBe(500);
    log.mockRestore();
  });
});
