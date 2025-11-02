/** @jest-environment node */

import { isSubscriber } from "@/lib/billing/is-subscriber";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

describe("isSubscriber", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it("should return true for active subscription", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        status: "active",
        trial_ends_at: null,
      },
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("user_subscriptions");
    expect(mockSupabase.select).toHaveBeenCalledWith("status, trial_ends_at");
    expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(mockSupabase.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
    expect(mockSupabase.limit).toHaveBeenCalledWith(1);
  });

  it("should return true for trialing subscription with future trial_ends_at", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        status: "trialing",
        trial_ends_at: futureDate.toISOString(),
      },
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(true);
  });

  it("should return false for trialing subscription with past trial_ends_at", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        status: "trialing",
        trial_ends_at: pastDate.toISOString(),
      },
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
  });

  it("should return false for trialing subscription with null trial_ends_at", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        status: "trialing",
        trial_ends_at: null,
      },
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
  });

  it("should return false when no subscription record exists", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
  });

  it("should return false when database query has error", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
  });

  it("should return false for non-active, non-trialing statuses", async () => {
    // First test with canceled status (should not match the .in() filter)
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
    expect(mockSupabase.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
  });

  it("should handle trialing subscription with exactly current timestamp", async () => {
    const now = new Date();

    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        status: "trialing",
        trial_ends_at: now.toISOString(),
      },
      error: null,
    });

    const result = await isSubscriber("user-123");

    // Should return false since trial_ends_at is not in the future
    expect(result).toBe(false);
  });

  it("should handle database connection errors gracefully", async () => {
    mockSupabase.maybeSingle.mockRejectedValue(new Error("Database connection failed"));

    // Should not throw, but return false
    const result = await isSubscriber("user-123");

    expect(result).toBe(false);
  });
});

