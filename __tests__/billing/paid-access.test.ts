/** @jest-environment node */
import { getPaidAccess, isSubscriber } from "@/lib/billing/paid-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));

const pass = {
  id: "pass-1",
  paid_at: "2026-10-01T00:00:00.000Z",
  expires_at: "2026-12-30T00:00:00.000Z",
  refunded_at: null,
};
const none = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };

describe("authoritative paid access", () => {
  let legacy: any;
  let passes: any;
  let from: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
    legacy = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    passes = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    from = jest.fn((table) => (table === "pmle_passes" ? passes : legacy));
    (createServerSupabaseClient as jest.Mock).mockReturnValue({ from });
  });
  afterEach(() => jest.useRealTimers());

  it("grants an unexpired, unrefunded pass", async () => {
    passes.order.mockResolvedValue({ data: [pass], error: null });
    expect(await getPaidAccess("user-1")).toEqual({
      hasPaidAccess: true,
      isLegacySubscriber: false,
      accessUntil: pass.expires_at,
      pass,
    });
    expect(passes.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(legacy.eq).toHaveBeenCalledWith("status", "active");
  });
  it.each([
    ["expired", { ...pass, expires_at: "2026-10-02T00:00:00.000Z" }],
    ["expiry boundary", { ...pass, expires_at: "2026-10-03T00:00:00.000Z" }],
    ["invalid expiry", { ...pass, expires_at: "invalid" }],
    ["refunded", { ...pass, refunded_at: "2026-10-02T00:00:00.000Z" }],
  ])("denies %s passes", async (_name, record) => {
    passes.order.mockResolvedValue({ data: [record], error: null });
    expect(await getPaidAccess("user-1")).toEqual({ ...none, pass: record });
  });
  it("preserves an active legacy subscription", async () => {
    legacy.maybeSingle.mockResolvedValue({
      data: { status: "active", current_period_end: pass.expires_at },
      error: null,
    });
    expect(await getPaidAccess("user-1")).toEqual({
      ...none,
      hasPaidAccess: true,
      isLegacySubscriber: true,
      accessUntil: pass.expires_at,
    });
  });
  it("returns no access for no purchase", async () => {
    expect(await getPaidAccess("user-1")).toEqual(none);
  });
  it.each(["trialing", "past_due", "canceled", "paused"])("excludes %s status", async (status) => {
    // Defensively reject a non-active result even if the DB filter malfunctions.
    legacy.maybeSingle.mockResolvedValue({
      data: { status, trial_ends_at: pass.expires_at },
      error: null,
    });
    expect(await isSubscriber("user-1")).toBe(false);
  });
  it("fails closed for database errors", async () => {
    legacy.maybeSingle.mockResolvedValue({ data: { status: "active" }, error: new Error("DB") });
    passes.order.mockResolvedValue({ data: [pass], error: new Error("DB") });
    expect(await getPaidAccess("user-1")).toEqual(none);
  });
  it("fails closed for thrown queries and client errors", async () => {
    legacy.maybeSingle.mockRejectedValue(new Error("DB"));
    passes.order.mockRejectedValue(new Error("DB"));
    expect(await getPaidAccess("user-1")).toEqual(none);
    (createServerSupabaseClient as jest.Mock).mockImplementation(() => {
      throw new Error("client");
    });
    expect(await getPaidAccess("user-1")).toEqual(none);
  });
  it("preserves legacy access if the pass query fails", async () => {
    legacy.maybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    passes.order.mockRejectedValue(new Error("migration unavailable"));
    expect((await getPaidAccess("user-1")).isLegacySubscriber).toBe(true);
  });
  it("preserves a valid pass if the legacy query fails", async () => {
    legacy.maybeSingle.mockRejectedValue(new Error("DB"));
    passes.order.mockResolvedValue({ data: [pass], error: null });
    expect(await isSubscriber("user-1")).toBe(true);
  });
  it("finds another valid pass when the newest purchase was refunded", async () => {
    passes.order.mockResolvedValue({
      data: [{ ...pass, id: "refunded", refunded_at: "2026-10-02" }, pass],
      error: null,
    });
    expect((await getPaidAccess("user-1")).pass).toEqual(pass);
  });
  it("revokes access on the next request after a refund without cache clearing", async () => {
    passes.order
      .mockResolvedValueOnce({ data: [pass], error: null })
      .mockResolvedValueOnce({ data: [{ ...pass, refunded_at: "2026-10-03" }], error: null });
    expect(await isSubscriber("user-1")).toBe(true);
    expect(await isSubscriber("user-1")).toBe(false);
    expect(from).toHaveBeenCalledTimes(4);
  });
  it("preserves active legacy access despite a refunded pass", async () => {
    legacy.maybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    passes.order.mockResolvedValue({ data: [{ ...pass, refunded_at: "2026-10-03" }], error: null });
    expect(await isSubscriber("user-1")).toBe(true);
  });
  it("does not query for an empty user id", async () => {
    expect(await getPaidAccess("")).toEqual(none);
    expect(from).not.toHaveBeenCalled();
  });
});
