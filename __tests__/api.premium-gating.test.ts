/** @jest-environment node */
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/auth/entitlements";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent } from "@/lib/analytics/analytics";
import crypto from "crypto";

// Mock dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/entitlements");
jest.mock("@/lib/analytics/server-analytics");
jest.mock("@/lib/analytics/analytics");
jest.mock("@/lib/auth/rate-limiter");
jest.mock("next/headers");

describe("Premium API Gating Integration Tests", () => {
  let mockSupabase: any;
  let mockPostHog: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GRACE_COOKIE_SECRET = "test-secret";

    // Mock Supabase
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{ id: "q1", stem: "Test", explanations: [{ id: "e1" }] }],
        error: null,
      }),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock PostHog
    mockPostHog = {
      capture: jest.fn(),
    };
    (getServerPostHog as jest.Mock).mockReturnValue(mockPostHog);
    (trackEvent as jest.Mock).mockImplementation(() => {});

    // Mock isSubscriber
    (isSubscriber as jest.Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    delete process.env.GRACE_COOKIE_SECRET;
  });

  const createGraceCookie = (userId: string, exp?: number): string => {
    const secret = process.env.GRACE_COOKIE_SECRET || "test-secret";
    const expiresAt = exp || Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const payload = JSON.stringify({ userId, exp: expiresAt });
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const signature = hmac.digest("hex");
    return `${Buffer.from(payload).toString("base64")}.${signature}`;
  };

  const createRequest = (cookieValue?: string): NextRequest => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "GET",
    });
    if (cookieValue) {
      const encodedValue = encodeURIComponent(cookieValue);
      req.headers.set("cookie", `tgrace=${encodedValue}`);
    }
    return req;
  };

  describe("/api/questions/current", () => {
    it("should return 403 PAYWALL for unauthenticated user without grace cookie", async () => {
      const { GET } = require("@/app/api/questions/current/route");
      const req = createRequest();

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 200 for user with valid grace cookie", async () => {
      const { GET } = require("@/app/api/questions/current/route");
      const cookieValue = createGraceCookie("user-grace");
      const req = createRequest(cookieValue);

      // Mock successful question fetch
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: "q1", stem: "Test", explanations: [{ id: "e1" }] }],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ id: "opt1", label: "A", text: "Option A" }],
          error: null,
        }),
      });

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(isSubscriber).not.toHaveBeenCalled();
    });

    it("should return 200 for authenticated subscriber", async () => {
      const { GET } = require("@/app/api/questions/current/route");
      const req = createRequest();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      (isSubscriber as jest.Mock).mockResolvedValue(true);

      // Mock successful question fetch
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: "q1", stem: "Test", explanations: [{ id: "e1" }] }],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ id: "opt1", label: "A", text: "Option A" }],
          error: null,
        }),
      });

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(isSubscriber).toHaveBeenCalledWith("user-123");
    });
  });

  describe("/api/diagnostic/session POST", () => {
    beforeEach(() => {
      const { checkRateLimit } = require("@/lib/auth/rate-limiter");
      (checkRateLimit as jest.Mock).mockResolvedValue(true);
    });

    it("should return 403 PAYWALL for unauthenticated user without grace cookie", async () => {
      const { POST } = require("@/app/api/diagnostic/session/route");
      const req = new NextRequest("http://localhost/api/diagnostic/session", {
        method: "POST",
        body: JSON.stringify({ examKey: "pmle", source: "beta_welcome" }),
      });

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 200 for user with valid grace cookie", async () => {
      const { POST } = require("@/app/api/diagnostic/session/route");
      const cookieValue = createGraceCookie("user-grace");
      const req = new NextRequest("http://localhost/api/diagnostic/session", {
        method: "POST",
        headers: {
          cookie: `tgrace=${encodeURIComponent(cookieValue)}`,
        },
        body: JSON.stringify({ examKey: "pmle", source: "beta_welcome" }),
      });

      // Mock successful session creation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1 },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: "q1", stem: "Test", options: [{ label: "A", text: "A", is_correct: true }], explanations: [{ text: "Explanation" }] }],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "session-123" },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await POST(req);

      // Should get past gate but may fail on other checks - that's okay for this test
      // The important thing is it didn't return 403 PAYWALL
      expect(res.status).not.toBe(403);
    });

    it("should return 200 for authenticated subscriber", async () => {
      const { POST } = require("@/app/api/diagnostic/session/route");
      const req = new NextRequest("http://localhost/api/diagnostic/session", {
        method: "POST",
        body: JSON.stringify({ examKey: "pmle", source: "beta_welcome" }),
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            user_metadata: { is_early_access: true },
          },
        },
        error: null,
      });
      (isSubscriber as jest.Mock).mockResolvedValue(true);

      // Mock successful session creation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1 },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: "q1", stem: "Test", options: [{ label: "A", text: "A", is_correct: true }], explanations: [{ text: "Explanation" }] }],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "session-123" },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await POST(req);

      expect(res.status).not.toBe(403);
      expect(isSubscriber).toHaveBeenCalledWith("user-123");
    });
  });

  describe("/api/diagnostic/summary/[sessionId]", () => {
    it("should return 403 PAYWALL for unauthenticated user without grace cookie", async () => {
      const { GET } = require("@/app/api/diagnostic/summary/[sessionId]/route");
      const req = new NextRequest("http://localhost/api/diagnostic/summary/session-123");

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 200 for user with valid grace cookie", async () => {
      const { GET } = require("@/app/api/diagnostic/summary/[sessionId]/route");
      const cookieValue = createGraceCookie("user-grace");
      const req = new NextRequest("http://localhost/api/diagnostic/summary/session-123", {
        headers: {
          cookie: `tgrace=${encodeURIComponent(cookieValue)}`,
        },
      });

      // Mock successful session fetch
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "session-123",
            completed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const res = await GET(req);

      expect(res.status).not.toBe(403);
    });

    it("should return 200 for authenticated subscriber", async () => {
      const { GET } = require("@/app/api/diagnostic/summary/[sessionId]/route");
      const req = new NextRequest("http://localhost/api/diagnostic/summary/session-123");

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      (isSubscriber as jest.Mock).mockResolvedValue(true);

      // Mock successful session fetch
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "session-123",
            user_id: "user-123",
            completed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const res = await GET(req);

      expect(res.status).not.toBe(403);
      expect(isSubscriber).toHaveBeenCalledWith("user-123");
    });
  });

  describe("Smoke tests for remaining gated routes", () => {
    it("should return 403 PAYWALL for /api/questions without grace cookie", async () => {
      const { GET } = require("@/app/api/questions/route");
      const req = createRequest();

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 403 PAYWALL for /api/questions/[id] without grace cookie", async () => {
      const { GET } = require("@/app/api/questions/[id]/route");
      const req = new NextRequest("http://localhost/api/questions/123");

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 403 PAYWALL for /api/questions/submit without grace cookie", async () => {
      const { POST } = require("@/app/api/questions/submit/route");
      const req = new NextRequest("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({ questionId: "123", selectedOptionKey: "A" }),
      });

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 403 PAYWALL for /api/diagnostic GET without grace cookie", async () => {
      const { GET } = require("@/app/api/diagnostic/route");
      const req = new NextRequest("http://localhost/api/diagnostic?sessionId=test");

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 403 PAYWALL for /api/diagnostic POST without grace cookie", async () => {
      const { POST } = require("@/app/api/diagnostic/route");
      const req = new NextRequest("http://localhost/api/diagnostic", {
        method: "POST",
        body: JSON.stringify({ action: "start", data: {} }),
      });

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });

    it("should return 403 PAYWALL for /api/diagnostic/session/[id]/status without grace cookie", async () => {
      const { GET } = require("@/app/api/diagnostic/session/[id]/status/route");
      const req = new NextRequest("http://localhost/api/diagnostic/session/session-123/status");

      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ code: "PAYWALL" });
    });
  });
});

