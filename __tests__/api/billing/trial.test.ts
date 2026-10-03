/** @jest-environment node */
import { existsSync } from "fs";
import { join } from "path";
import { isSubscriber } from "@/lib/billing/paid-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));

describe("trial retirement", () => {
  let legacy: any;
  beforeEach(() => {
    jest.clearAllMocks();
    legacy = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const passes = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn((table) => (table === "pmle_passes" ? passes : legacy)),
    });
  });
  it("removes the trial creation endpoint rather than exposing free access", () => {
    expect(existsSync(join(process.cwd(), "app/api/billing/trial/route.ts"))).toBe(false);
  });
  it("does not grant paid access for trialing status even with a future end", async () => {
    legacy.maybeSingle.mockResolvedValue({
      data: { status: "trialing", trial_ends_at: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    expect(await isSubscriber("user-1")).toBe(false);
  });
  it("preserves active legacy status", async () => {
    legacy.maybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    expect(await isSubscriber("user-1")).toBe(true);
  });
  it.each([
    "none",
    "canceled",
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const)("does not grant access for %s status", async (status) => {
    legacy.maybeSingle.mockResolvedValue({ data: { status }, error: null });
    expect(await isSubscriber("user-1")).toBe(false);
  });
  it("does not grant access for missing metadata", async () => {
    expect(await isSubscriber("user-1")).toBe(false);
  });
});
