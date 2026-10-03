import { requireSubscriber } from "@/lib/auth/require-subscriber";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/auth/entitlements";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { cookies } from "next/headers";
import { isBillingEnforcementActive } from "@/lib/billing/enforcement";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PAYWALL_GRACE_COOKIE } from "@/lib/billing/grace-cookie";

// Mock NextResponse
jest.mock("next/server", () => ({
  NextRequest: jest.requireActual("next/server").NextRequest,
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      cookies: { set: jest.fn() },
    })),
  },
}));

// Mock dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/entitlements");
jest.mock("@/lib/analytics/server-analytics");
jest.mock("@/lib/analytics/analytics");
jest.mock("next/headers");
jest.mock("@/lib/billing/enforcement", () => ({
  isBillingEnforcementActive: jest.fn(() => true),
}));

describe("requireSubscriber", () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockPostHog: any;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (isSubscriber as jest.Mock).mockResolvedValue(false);
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    
    // Set PAYWALL_SIGNING_SECRET for tests
    process.env.PAYWALL_SIGNING_SECRET = "test-secret";
    
    // Mock console.log for structured logging
    consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Mock Supabase
    mockUser = { id: "user-123", email: "test@example.com" };
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock PostHog
    mockPostHog = {
      capture: jest.fn(),
    };
    (getServerPostHog as jest.Mock).mockReturnValue(mockPostHog);

    // Mock trackEvent
    (trackEvent as jest.Mock).mockImplementation(() => {});

    // Mock cookies
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
    });
  });

  afterEach(() => {
    delete process.env.PAYWALL_SIGNING_SECRET;
    consoleSpy.mockRestore();
  });

  const createRequest = (cookieValue?: string): NextRequest => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "GET",
    });
    if (cookieValue) {
      req.cookies.set(PAYWALL_GRACE_COOKIE, cookieValue);
    }
    return req;
  };

  const createGraceCookie = (_userId: string, exp?: number): string => {
    const expiresAt = exp || Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const payload = JSON.stringify({ checkoutSuccess: true, exp: expiresAt });
    const signature = crypto.createHmac("sha256", "test-secret").update(payload).digest("base64url");
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
  };
  it("bypasses auth and subscription checks when billing enforcement is disabled", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(false);
    expect(await requireSubscriber(createRequest(), "/api/test")).toBeNull();
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(isSubscriber).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  describe("grace cookie validation", () => {
    it("should allow access with valid grace cookie", async () => {
      const cookieValue = createGraceCookie("user-grace");
      const req = createRequest(cookieValue);

      const result = await requireSubscriber(req, "/api/test");

      expect(result).toBeNull();
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
      expect(isSubscriber).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it("should block access with expired grace cookie", async () => {
      const expiredExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const cookieValue = createGraceCookie("user-grace", expiredExp);
      const req = createRequest(cookieValue);

      const result = await requireSubscriber(req, "/api/test");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body).toEqual({ code: "PAYWALL" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"paywall_block"')
      );
      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        expect.objectContaining({
          route: "/api/test",
          reason: "not_subscriber",
        }),
        "user-123"
      );
    });

    it("should block access with invalid signature", async () => {
      const payload = JSON.stringify({ checkoutSuccess: true, exp: Math.floor(Date.now() / 1000) + 3600 });
      const invalidCookie = `${Buffer.from(payload).toString("base64url")}.invalid-signature`;
      const req = createRequest(invalidCookie);

      const result = await requireSubscriber(req, "/api/test");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body).toEqual({ code: "PAYWALL" });
      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        expect.objectContaining({
          route: "/api/test",
          reason: "not_subscriber",
        }),
        "user-123"
      );
    });
  });

  describe("authentication and subscription checks", () => {
    it("should block unauthenticated users without grace cookie", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const req = createRequest();

      const result = await requireSubscriber(req, "/api/test");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body).toEqual({ code: "PAYWALL" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"paywall_block"')
      );
      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        expect.objectContaining({
          route: "/api/test",
          reason: "unauthenticated",
          userId: null,
        }),
        undefined
      );
    });

    it("should allow authenticated subscribers", async () => {
      (isSubscriber as jest.Mock).mockResolvedValue(true);
      const req = createRequest();

      const result = await requireSubscriber(req, "/api/test");

      expect(result).toBeNull();
      expect(isSubscriber).toHaveBeenCalledWith("user-123");
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it("should block authenticated non-subscribers", async () => {
      (isSubscriber as jest.Mock).mockResolvedValue(false);
      const req = createRequest();

      const result = await requireSubscriber(req, "/api/test");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body).toEqual({ code: "PAYWALL" });
      expect(isSubscriber).toHaveBeenCalledWith("user-123");
      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        expect.objectContaining({
          route: "/api/test",
          reason: "not_subscriber",
          userId: "user-123",
        }),
        "user-123"
      );
    });
  });

  describe("structured logging", () => {
    it("should emit structured log with correct format", async () => {
      (isSubscriber as jest.Mock).mockResolvedValue(false);
      const req = createRequest();

      await requireSubscriber(req, "/api/questions/current");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\{"event":"paywall_block","route":"\/api\/questions\/current","userId":"user-123","reason":"not_subscriber","ts":"[^"]+"\}$/)
      );
    });
  });

  describe("Request vs NextRequest compatibility", () => {
    it("should work with plain Request object", async () => {
      const cookieValue = createGraceCookie("user-grace");
      const mockHeaders = new Headers();
      mockHeaders.set("cookie", `${PAYWALL_GRACE_COOKIE}=${cookieValue}`);
      const req = {
        headers: mockHeaders,
      } as unknown as Request;

      const result = await requireSubscriber(req, "/api/test");

      expect(result).toBeNull();
    });

    it("should block plain Request without grace cookie", async () => {
      const req = {
        headers: {
          get: () => null,
        },
      } as unknown as Request;
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await requireSubscriber(req, "/api/test");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });
  });
});

