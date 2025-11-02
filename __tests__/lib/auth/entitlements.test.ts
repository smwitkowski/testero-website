import { isSubscriber, clearAllSubscriberCache } from "@/lib/auth/entitlements";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

describe("entitlements", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllSubscriberCache(); // Clear cache between tests
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe("isSubscriber", () => {
    it("should return true for user with active subscription", async () => {
      const userId = "user-123";
      mockSupabase.in.mockResolvedValue({
        data: [{ id: "sub-1", status: "active" }],
        error: null,
      });

      const result = await isSubscriber(userId);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("user_subscriptions");
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", userId);
      expect(mockSupabase.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
    });

    it("should return true for user with trialing subscription", async () => {
      const userId = "user-456";
      mockSupabase.in.mockResolvedValue({
        data: [{ id: "sub-2", status: "trialing" }],
        error: null,
      });

      const result = await isSubscriber(userId);

      expect(result).toBe(true);
    });

    it("should return false for user with no subscription", async () => {
      const userId = "user-789";
      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await isSubscriber(userId);

      expect(result).toBe(false);
    });

    it("should return false for user with canceled subscription", async () => {
      const userId = "user-999";
      // Canceled subscriptions are filtered out by .in('status', ['active', 'trialing'])
      // so the query returns empty array
      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await isSubscriber(userId);

      expect(result).toBe(false);
    });

    it("should return false on database error", async () => {
      const userId = "user-error";
      mockSupabase.in.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await isSubscriber(userId);

      expect(result).toBe(false);
    });

    it("should cache results and not query database on subsequent calls within TTL", async () => {
      const userId = "user-cached";
      mockSupabase.in.mockResolvedValue({
        data: [{ id: "sub-4", status: "active" }],
        error: null,
      });

      // First call
      const result1 = await isSubscriber(userId);
      expect(result1).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await isSubscriber(userId);
      expect(result2).toBe(true);
      // Should not have called database again
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("should cache results separately for different users", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      
      mockSupabase.in.mockResolvedValue({
        data: [{ id: "sub-6", status: "active" }],
        error: null,
      });

      // First call for user 1
      await isSubscriber(userId1);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // First call for user 2 - should query database
      await isSubscriber(userId2);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);

      // Second call for user 1 - should use cache
      await isSubscriber(userId1);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);

      // Second call for user 2 - should use cache
      await isSubscriber(userId2);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });
});

