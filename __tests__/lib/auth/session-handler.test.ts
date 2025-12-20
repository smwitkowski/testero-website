/** @jest-environment node */
import { getCurrentSession, SessionResponse } from "@/lib/auth/session-handler";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

describe("getCurrentSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns user data when authenticated", async () => {
    const mockUser = {
      id: "user123",
      email: "test@example.com",
      email_confirmed_at: "2025-12-16T13:09:44.290183Z",
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    });

    const result = await getCurrentSession();

    expect(result).toEqual({
      user: {
        id: "user123",
        email: "test@example.com",
        email_confirmed_at: "2025-12-16T13:09:44.290183Z",
      },
    });
  });

  test("returns null user when not authenticated", async () => {
    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const result = await getCurrentSession();

    expect(result).toEqual({ user: null });
  });

  test("returns null user when getUser returns error", async () => {
    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Authentication failed" },
        }),
      },
    });

    const result = await getCurrentSession();

    expect(result).toEqual({ user: null });
  });

  test("handles exceptions gracefully and returns null user", async () => {
    (createServerSupabaseClient as jest.Mock).mockImplementation(() => {
      throw new Error("Unexpected database error");
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const result = await getCurrentSession();

    expect(result).toEqual({ user: null });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Session fetch error:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  test("returns correct type structure", async () => {
    const mockUser = {
      id: "user456",
      email: "typed@example.com",
      email_confirmed_at: null,
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    });

    const result: SessionResponse = await getCurrentSession();

    // Type assertion to validate structure matches SessionResponse
    expect(result.user).toBeDefined();
    if (result.user) {
      expect(typeof result.user.id).toBe("string");
      expect(typeof result.user.email).toBe("string");
      expect(result.user.email_confirmed_at).toBeNull();
    }
  });
});
