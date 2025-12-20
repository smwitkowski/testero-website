/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/session/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns user when authenticated", async () => {
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

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
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

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ user: null });
  });

  test("returns null user when getUser returns error", async () => {
    (createServerSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Not authenticated" },
        }),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ user: null });
  });

  test("handles exceptions gracefully", async () => {
    (createServerSupabaseClient as jest.Mock).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ user: null });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Session endpoint error:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
