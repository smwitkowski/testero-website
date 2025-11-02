/** @jest-environment node */
import { NextRequest } from "next/server";
import { isSubscriber, requireSubscriber, clearCache } from "@/lib/billing/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent } from "@/lib/analytics/analytics";
import { verifyGraceCookie } from "@/lib/billing/grace-cookie";

jest.mock("@/lib/supabase/server");
jest.mock("@/lib/analytics/server-analytics");
jest.mock("@/lib/analytics/analytics");
jest.mock("@/lib/billing/grace-cookie");

describe("billing access", () => {
  const originalEnv = process.env;
  let mockSupabase: any;
  let mockPostHog: any;

  beforeEach(() => {
    clearCache(); // Clear cache before each test
    process.env = { ...originalEnv };
    process.env.BILLING_ENFORCEMENT = "active_required";

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockPostHog = {
      capture: jest.fn(),
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (getServerPostHog as jest.Mock).mockReturnValue(mockPostHog);
    (verifyGraceCookie as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
    clearCache(); // Clear cache after each test
  });

  describe("isSubscriber", () => {
    it("should return true for active status", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "active",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("user_subscriptions");
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockSupabase.order).toHaveBeenCalledWith("current_period_end", { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(1);
    });

    it("should return true for trialing status", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "trialing",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(true);
    });

    it("should return true for cancel_at_period_end with future period_end", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "active",
          cancel_at_period_end: true,
          current_period_end: futureDate,
        },
        error: null,
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(true);
    });

    it("should return false for cancel_at_period_end with past period_end", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "active",
          cancel_at_period_end: true,
          current_period_end: pastDate,
        },
        error: null,
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(false);
    });

    it("should return false for past_due status", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "past_due",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(false);
    });

    it("should return false when no subscription exists", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const result = await isSubscriber("user-123");
      expect(result).toBe(false);
    });

    it("should cache positive results for 60 seconds", async () => {
      jest.useFakeTimers();
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "active",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const result1 = await isSubscriber("user-123");
      expect(result1).toBe(true);
      expect(mockSupabase.single).toHaveBeenCalledTimes(1);

      // Advance 59 seconds - should still be cached
      jest.advanceTimersByTime(59 * 1000);
      const result2 = await isSubscriber("user-123");
      expect(result2).toBe(true);
      expect(mockSupabase.single).toHaveBeenCalledTimes(1);

      // Advance past 60 seconds - should query again
      jest.advanceTimersByTime(2000);
      const result3 = await isSubscriber("user-123");
      expect(result3).toBe(true);
      expect(mockSupabase.single).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("should cache negative results for 30 seconds", async () => {
      jest.useFakeTimers();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const result1 = await isSubscriber("user-123");
      expect(result1).toBe(false);
      expect(mockSupabase.single).toHaveBeenCalledTimes(1);

      // Advance 29 seconds - should still be cached
      jest.advanceTimersByTime(29 * 1000);
      const result2 = await isSubscriber("user-123");
      expect(result2).toBe(false);
      expect(mockSupabase.single).toHaveBeenCalledTimes(1);

      // Advance past 30 seconds - should query again
      jest.advanceTimersByTime(2000);
      const result3 = await isSubscriber("user-123");
      expect(result3).toBe(false);
      expect(mockSupabase.single).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe("requireSubscriber", () => {
    it("should allow when BILLING_ENFORCEMENT is 'off'", async () => {
      process.env.BILLING_ENFORCEMENT = "off";
      const req = new NextRequest("https://example.com/api/test");

      const result = await requireSubscriber(req, "user-123");

      expect(result.allowed).toBe(true);
      expect(mockSupabase.single).not.toHaveBeenCalled();
    });

    it("should allow when user is subscriber", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "active",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const req = new NextRequest("https://example.com/api/test");

      const result = await requireSubscriber(req, "user-123");

      expect(result.allowed).toBe(true);
    });

    it("should allow when grace cookie is valid", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });
      (verifyGraceCookie as jest.Mock).mockReturnValue(true);

      const req = new NextRequest("https://example.com/api/test");

      const result = await requireSubscriber(req, "user-123");

      expect(result.allowed).toBe(true);
    });

    it("should block when user is not subscriber and no grace cookie", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });
      (verifyGraceCookie as jest.Mock).mockReturnValue(false);

      const req = new NextRequest("https://example.com/api/test");

      const result = await requireSubscriber(req, "user-123");

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("PAYWALL");
      expect(result.details).toBeDefined();
    });

    it("should log and emit analytics on block", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "past_due",
          cancel_at_period_end: false,
          current_period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });
      (verifyGraceCookie as jest.Mock).mockReturnValue(false);

      const req = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-request-id": "req-123",
        },
      });

      await requireSubscriber(req, "user-123");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          paywall_block: expect.objectContaining({
            user_id: "user-123",
            route: "/api/test",
            request_id: "req-123",
          }),
        })
      );

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        "entitlement_check_failed",
        expect.objectContaining({
          user_id: "user-123",
          route: "/api/test",
          request_id: "req-123",
          computed_status: "past_due",
        }),
        "user-123"
      );

      consoleWarnSpy.mockRestore();
    });

    it("should extract route from NextRequest", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const req = new NextRequest("https://example.com/api/practice/current");

      const result = await requireSubscriber(req, "user-123");

      expect(result.details?.route).toBe("/api/practice/current");
    });

    it("should extract route from standard Request", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const req = new Request("https://example.com/api/dashboard");

      const result = await requireSubscriber(req, "user-123");

      expect(result.details?.route).toBe("/api/dashboard");
    });

    it("should extract request_id from x-request-id header", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const req = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-request-id": "custom-req-id",
        },
      });

      await requireSubscriber(req, "user-123");

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        "entitlement_check_failed",
        expect.objectContaining({
          request_id: "custom-req-id",
        }),
        "user-123"
      );
    });

    it("should extract request_id from x-vercel-id header if x-request-id missing", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const req = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-vercel-id": "vercel-id-123",
        },
      });

      await requireSubscriber(req, "user-123");

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        "entitlement_check_failed",
        expect.objectContaining({
          request_id: "vercel-id-123",
        }),
        "user-123"
      );
    });

    it("should include subscription details in block response", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockSupabase.single.mockResolvedValue({
        data: {
          status: "past_due",
          cancel_at_period_end: true,
          current_period_end: futureDate,
        },
        error: null,
      });

      const req = new NextRequest("https://example.com/api/test");

      const result = await requireSubscriber(req, "user-123");

      expect(result.details).toMatchObject({
        computed_status: "past_due",
        cancel_at_period_end: true,
        current_period_end: futureDate,
      });
    });
  });
});

