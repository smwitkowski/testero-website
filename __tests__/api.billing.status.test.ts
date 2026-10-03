/** @jest-environment node */
import { GET } from "@/app/api/billing/status/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaidAccess } from "@/lib/billing/paid-access";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: jest.fn() }));

const empty = {
  isSubscriber: false,
  status: "none",
  accessType: null,
  accessUntil: null,
  canManageSubscription: false,
};
const noAccess = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };

describe("GET /api/billing/status", () => {
  let db: any;
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
    (getPaidAccess as jest.Mock).mockResolvedValue(noAccess);
  });
  it("returns empty metadata for anonymous users", async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await (await GET()).json()).toEqual(empty);
    expect(getPaidAccess).not.toHaveBeenCalled();
  });
  it("fails closed on auth errors even if a user object is returned", async () => {
    db.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: new Error("auth"),
    });
    expect(await (await GET()).json()).toEqual(empty);
    expect(getPaidAccess).not.toHaveBeenCalled();
  });
  it("returns no access for no purchases", async () => {
    expect(await (await GET()).json()).toEqual(empty);
    expect(getPaidAccess).toHaveBeenCalledWith("user-1");
  });
  it("returns pass access without subscription management or Stripe IDs", async () => {
    (getPaidAccess as jest.Mock).mockResolvedValue({
      ...noAccess,
      hasPaidAccess: true,
      accessUntil: "2026-12-30",
      pass: { id: "pass-1" },
    });
    expect(await (await GET()).json()).toEqual({
      ...empty,
      isSubscriber: true,
      accessType: "pass",
      accessUntil: "2026-12-30",
    });
  });
  it.each(["expired", "refunded"])("returns no access for %s pass", async () => {
    (getPaidAccess as jest.Mock).mockResolvedValue({ ...noAccess, pass: { id: "pass-1" } });
    expect(await (await GET()).json()).toEqual(empty);
  });
  it("preserves active legacy metadata and management", async () => {
    (getPaidAccess as jest.Mock).mockResolvedValue({
      ...noAccess,
      hasPaidAccess: true,
      isLegacySubscriber: true,
      accessUntil: "2026-11-03",
    });
    db.maybeSingle.mockResolvedValue({
      data: {
        status: "active",
        stripe_customer_id: "cus_legacy",
        stripe_subscription_id: "sub_legacy",
      },
      error: null,
    });
    expect(await (await GET()).json()).toEqual({
      isSubscriber: true,
      status: "active",
      accessType: "legacy_subscription",
      accessUntil: "2026-11-03",
      canManageSubscription: true,
    });
    expect(db.not).toHaveBeenCalledWith("stripe_subscription_id", "is", null);
  });
  it.each(["past_due", "canceled", "trialing"])(
    "retains %s legacy status without granting access",
    async (status) => {
      db.maybeSingle.mockResolvedValue({
        data: { status, stripe_customer_id: "cus_legacy", stripe_subscription_id: "sub_legacy" },
        error: null,
      });
      expect(await (await GET()).json()).toEqual({ ...empty, status, canManageSubscription: true });
    }
  );
  it("does not enable management for a customer without a legacy subscription", async () => {
    db.maybeSingle.mockResolvedValue({
      data: { status: "none", stripe_customer_id: "cus_pass", stripe_subscription_id: null },
      error: null,
    });
    expect(await (await GET()).json()).toEqual(empty);
  });
  it("does not revoke verified paid access on a metadata DB error", async () => {
    (getPaidAccess as jest.Mock).mockResolvedValue({
      ...noAccess,
      hasPaidAccess: true,
      isLegacySubscriber: true,
    });
    db.maybeSingle.mockRejectedValue(new Error("DB"));
    expect(await (await GET()).json()).toEqual({
      ...empty,
      isSubscriber: true,
      status: "active",
      accessType: "legacy_subscription",
    });
  });
  it("fails closed on unexpected access errors", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    (getPaidAccess as jest.Mock).mockRejectedValue(new Error("DB"));
    expect(await (await GET()).json()).toEqual(empty);
    log.mockRestore();
  });
});
