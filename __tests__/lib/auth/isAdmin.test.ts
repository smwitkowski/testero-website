import { isAdmin } from "@/lib/auth/isAdmin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

// Mock the Supabase service client
jest.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: jest.fn(),
}));

// Mock React's cache function to use a simple memoization for tests
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: Function) => fn, // In tests, disable caching to make tests independent
}));

describe("isAdmin", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createServiceSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isAdmin", () => {
    it("should return false for null user", async () => {
      const result = await isAdmin(null as any);
      expect(result).toBe(false);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("should return false for user without id", async () => {
      const result = await isAdmin({ email: "test@example.com" } as any);
      expect(result).toBe(false);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("should return true when user exists in admin_users table", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { user_id: "admin-user-1" },
        error: null,
      });

      const user = { id: "admin-user-1", email: "admin@example.com" };
      const result = await isAdmin(user);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("admin_users");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("user_id");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", "admin-user-1");
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
      expect(mockSupabaseClient.single).toHaveBeenCalled();
    });

    it("should return false when user does not exist in admin_users table", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "No rows returned" },
      });

      const user = { id: "regular-user", email: "user@example.com" };
      const result = await isAdmin(user);

      expect(result).toBe(false);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("admin_users");
    });

    it("should return false on database error (fail closed)", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: "UNKNOWN_ERROR", message: "Database connection failed" },
      });

      const user = { id: "any-user", email: "user@example.com" };
      const result = await isAdmin(user);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[isAdmin] Database error:",
        expect.objectContaining({ code: "UNKNOWN_ERROR" })
      );
      consoleErrorSpy.mockRestore();
    });

    it("should return false on unexpected error (fail closed)", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockSupabaseClient.single.mockRejectedValue(new Error("Unexpected error"));

      const user = { id: "any-user", email: "user@example.com" };
      const result = await isAdmin(user);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[isAdmin] Unexpected error:",
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it("should query database for each check in test environment", async () => {
      // Note: React's cache() is disabled in test environment (mocked above)
      // to ensure test independence, so each call queries the database
      mockSupabaseClient.single.mockResolvedValue({
        data: { user_id: "admin-user-1" },
        error: null,
      });

      const user = { id: "admin-user-1", email: "admin@example.com" };

      // First call
      const result1 = await isAdmin(user);
      expect(result1).toBe(true);

      // Second call also queries database (caching disabled in tests)
      const result2 = await isAdmin(user);
      expect(result2).toBe(true);

      // In tests, we disable caching for independence
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(2);
    });

    it("should handle user without email", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { user_id: "admin-user-1" },
        error: null,
      });

      const user = { id: "admin-user-1" };
      const result = await isAdmin(user);

      expect(result).toBe(true);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", "admin-user-1");
    });

    it("should handle user with null email", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { user_id: "admin-user-1" },
        error: null,
      });

      const user = { id: "admin-user-1", email: null };
      const result = await isAdmin(user);

      expect(result).toBe(true);
    });

    it("should query different users separately", async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { user_id: "admin-user-1" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116" },
        });

      const adminUser = { id: "admin-user-1", email: "admin@example.com" };
      const regularUser = { id: "regular-user", email: "user@example.com" };

      const adminResult = await isAdmin(adminUser);
      const regularResult = await isAdmin(regularUser);

      expect(adminResult).toBe(true);
      expect(regularResult).toBe(false);
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(2);
    });
  });
});
