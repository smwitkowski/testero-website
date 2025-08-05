/** @jest-environment node */
import { NextRequest } from "next/server";

let serverSupabaseMock: any = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
};

jest.mock("../lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => serverSupabaseMock),
}));

jest.mock("../lib/auth/anonymous-session-server", () => ({
  getAnonymousSessionIdFromCookie: jest.fn().mockResolvedValue(null),
}));

import { GET as sessionStatusGET } from "../app/api/diagnostic/session/[id]/status/route";
import { getAnonymousSessionIdFromCookie } from "../lib/auth/anonymous-session-server";

describe("Diagnostic Session Status API", () => {
  beforeEach(() => {
    serverSupabaseMock.auth.getUser.mockReset();
    serverSupabaseMock.from.mockReset();
    (getAnonymousSessionIdFromCookie as jest.Mock).mockResolvedValue(null);
  });

  describe("GET /api/diagnostic/session/[id]/status", () => {
    it("returns not found for non-existent session", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const singleMock = jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest("http://localhost/api/diagnostic/session/invalid-id/status");
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(false);
      expect(json.status).toBe("not_found");
    });

    it("returns expired for expired session", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const expiredDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const sessionData = {
        id: "session-123",
        user_id: null,
        anonymous_session_id: "anon-123",
        completed_at: null,
        expires_at: expiredDate,
        exam_type: "Google ML Engineer",
        started_at: new Date().toISOString(),
      };

      const singleMock = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest("http://localhost/api/diagnostic/session/session-123/status");
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(true);
      expect(json.status).toBe("expired");
    });

    it("returns unauthorized for wrong anonymous session", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
      const sessionData = {
        id: "session-123",
        user_id: null,
        anonymous_session_id: "anon-correct",
        completed_at: null,
        expires_at: futureDate,
        exam_type: "Google ML Engineer",
        started_at: new Date().toISOString(),
      };

      const singleMock = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest(
        "http://localhost/api/diagnostic/session/session-123/status?anonymousSessionId=anon-wrong"
      );
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(true);
      expect(json.status).toBe("unauthorized");
    });

    it("returns unauthorized for wrong user", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-wrong" } },
        error: null,
      });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const sessionData = {
        id: "session-123",
        user_id: "user-correct",
        anonymous_session_id: null,
        completed_at: null,
        expires_at: futureDate,
        exam_type: "Google ML Engineer",
        started_at: new Date().toISOString(),
      };

      const singleMock = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest("http://localhost/api/diagnostic/session/session-123/status");
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(true);
      expect(json.status).toBe("unauthorized");
    });

    it("returns completed for completed session", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const completedDate = new Date().toISOString();
      const sessionData = {
        id: "session-123",
        user_id: "user-123",
        anonymous_session_id: null,
        completed_at: completedDate,
        expires_at: futureDate,
        exam_type: "Google ML Engineer",
        started_at: new Date().toISOString(),
      };

      const singleMock = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest("http://localhost/api/diagnostic/session/session-123/status");
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(true);
      expect(json.status).toBe("completed");
      expect(json.completedAt).toBe(completedDate);
    });

    it("returns active for valid active session", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const startedDate = new Date().toISOString();
      const sessionData = {
        id: "session-123",
        user_id: null,
        anonymous_session_id: "anon-123",
        completed_at: null,
        expires_at: futureDate,
        exam_type: "Google ML Engineer",
        started_at: startedDate,
      };

      const singleMock = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest(
        "http://localhost/api/diagnostic/session/session-123/status?anonymousSessionId=anon-123"
      );
      const res = await sessionStatusGET(req);

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.exists).toBe(true);
      expect(json.status).toBe("active");
      expect(json.examType).toBe("Google ML Engineer");
      expect(json.startedAt).toBe(startedDate);
      expect(json.expiresAt).toBe(futureDate);
    });

    it("returns 400 for invalid session ID", async () => {
      const req = new NextRequest("http://localhost/api/diagnostic/session//status");
      const res = await sessionStatusGET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid session ID");
    });

    it("handles database errors gracefully", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const singleMock = jest.fn().mockRejectedValue(new Error("Database connection failed"));
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMock = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const req = new NextRequest("http://localhost/api/diagnostic/session/session-123/status");
      const res = await sessionStatusGET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Internal server error");
    });
  });
});
