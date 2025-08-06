/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/diagnostic/session/[id]/status/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAnonymousSessionIdFromCookie } from "@/lib/auth/anonymous-session-server";

// Mock the dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/anonymous-session-server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;
const mockGetAnonymousSessionIdFromCookie = getAnonymousSessionIdFromCookie as jest.MockedFunction<
  typeof getAnonymousSessionIdFromCookie
>;

describe("GET /api/diagnostic/session/[id]/status", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
    mockGetAnonymousSessionIdFromCookie.mockResolvedValue(null);
  });

  describe("Session existence checks", () => {
    it("should return not_found status when session does not exist", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: false,
        status: "not_found",
      });
    });

    it("should return expired status when session has expired", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: null,
          expires_at: expiredDate.toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "expired",
      });
    });

    it("should return completed status when session is completed", async () => {
      const completedAt = new Date().toISOString();
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: completedAt,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
        },
        error: null,
      });

      mockGetAnonymousSessionIdFromCookie.mockResolvedValue("anon-456");

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "completed",
        completedAt,
      });
    });

    it("should return active status when session is active and accessible", async () => {
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: null,
          expires_at: expiresAt,
          exam_type: "Google Professional ML Engineer",
          started_at: startedAt,
        },
        error: null,
      });

      mockGetAnonymousSessionIdFromCookie.mockResolvedValue("anon-456");

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "active",
        examType: "Google Professional ML Engineer",
        startedAt,
        expiresAt,
      });
    });
  });

  describe("Authorization checks", () => {
    it("should return unauthorized for logged-in user accessing another users session", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-789", email: "test@example.com" } },
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: "user-999", // Different user
          anonymous_session_id: null,
          completed_at: null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "unauthorized",
      });
    });

    it("should return unauthorized for anonymous session with wrong ID", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
        },
        error: null,
      });

      // Wrong anonymous session ID
      mockGetAnonymousSessionIdFromCookie.mockResolvedValue("anon-wrong");

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "unauthorized",
      });
    });

    it("should allow access with query parameter anonymousSessionId", async () => {
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: null,
          expires_at: expiresAt,
          exam_type: "Google Professional ML Engineer",
          started_at: startedAt,
        },
        error: null,
      });

      // Cookie returns null, but query param has correct ID
      mockGetAnonymousSessionIdFromCookie.mockResolvedValue(null);

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        exists: true,
        status: "active",
        examType: "Google Professional ML Engineer",
        startedAt,
        expiresAt,
      });
    });
  });

  describe("Error handling", () => {
    it("should return 400 for invalid session ID", async () => {
      const req = new Request("http://localhost:3000/api/diagnostic/session//status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid session ID" });
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.single.mockRejectedValue(new Error("Database connection failed"));

      const req = new Request(
        "http://localhost:3000/api/diagnostic/session/test-session-123/status"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
    });
  });
});
