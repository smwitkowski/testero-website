/** @jest-environment node */

// Mock dependencies before imports
const mockCheckRateLimit = jest.fn();
const mockSignupBusinessLogic = jest.fn();
const mockPostHogCapture = jest.fn();

jest.mock("../lib/auth/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMIT_CONFIG: {
    WINDOW_SECONDS: 60,
    MAX_REQUESTS: 3,
    KEY_PREFIX: "rate_limit",
  },
}));

jest.mock("../lib/auth/signup-handler", () => ({
  signupBusinessLogic: mockSignupBusinessLogic,
}));

jest.mock("../lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

jest.mock("../lib/auth/anonymous-session-server", () => ({
  getAnonymousSessionIdFromCookie: jest.fn().mockResolvedValue(null),
  clearAnonymousSessionIdCookie: jest.fn(),
}));

jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockPostHogCapture,
    shutdown: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/signup/route";

describe("Signup Endpoint Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default, allow requests
    mockCheckRateLimit.mockResolvedValue(true);
    // Mock successful signup
    mockSignupBusinessLogic.mockResolvedValue({
      status: 200,
      body: { status: "ok" },
    });
  });

  describe("Rate Limiting Enforcement", () => {
    it("should allow requests when rate limit is not exceeded", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(mockCheckRateLimit).toHaveBeenCalledWith("unknown");
      expect(mockSignupBusinessLogic).toHaveBeenCalled();
    });

    it("should block requests when rate limit is exceeded", async () => {
      // Mock rate limit exceeded
      mockCheckRateLimit.mockResolvedValue(false);

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Too many sign-up attempts");
      expect(mockCheckRateLimit).toHaveBeenCalledWith("unknown");
      expect(mockSignupBusinessLogic).not.toHaveBeenCalled();
    });

    it("should simulate multiple requests hitting rate limit", async () => {
      // Simulate first 3 requests allowed, 4th blocked
      let callCount = 0;
      mockCheckRateLimit.mockImplementation(async () => {
        callCount++;
        return callCount <= 3;
      });

      const responses = [];
      for (let i = 0; i < 4; i++) {
        const req = new NextRequest("http://localhost:3000/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "192.168.1.100",
          },
          body: JSON.stringify({
            email: `test${i}@example.com`,
            password: "password123",
          }),
        });

        const response = await POST(req);
        responses.push({
          status: response.status,
          data: await response.json(),
        });
      }

      // First 3 requests should succeed
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);
      expect(responses[0].data.status).toBe("ok");

      // 4th request should be rate limited
      expect(responses[3].status).toBe(429);
      expect(responses[3].data.error).toBe("Too many sign-up attempts");
    });
  });

  describe("IP Address Extraction", () => {
    it("should extract IP from x-forwarded-for header", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.100",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      await POST(req);
      expect(mockCheckRateLimit).toHaveBeenCalledWith("192.168.1.100");
    });

    it("should extract IP from x-real-ip header as fallback", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "10.0.0.50",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      await POST(req);
      expect(mockCheckRateLimit).toHaveBeenCalledWith("10.0.0.50");
    });

    it("should use 'unknown' when no IP headers are present", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      await POST(req);
      expect(mockCheckRateLimit).toHaveBeenCalledWith("unknown");
    });

    it("should prefer x-forwarded-for over x-real-ip", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.100",
          "x-real-ip": "10.0.0.50",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      await POST(req);
      expect(mockCheckRateLimit).toHaveBeenCalledWith("192.168.1.100");
    });
  });

  describe("Analytics Tracking", () => {
    it("should track rate limited attempts in PostHog", async () => {
      mockCheckRateLimit.mockResolvedValue(false);

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.100",
        },
        body: JSON.stringify({
          email: "blocked@example.com",
          password: "password123",
        }),
      });

      await POST(req);

      expect(mockPostHogCapture).toHaveBeenCalledWith({
        event: "signup_rate_limited",
        properties: {
          ip: "192.168.1.100",
          email: "blocked@example.com",
        },
        distinctId: "blocked@example.com",
      });
    });

    it("should not track analytics for successful requests", async () => {
      mockCheckRateLimit.mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "success@example.com",
          password: "password123",
        }),
      });

      await POST(req);

      // PostHog capture should not be called for rate limiting event
      expect(mockPostHogCapture).not.toHaveBeenCalledWith(
        expect.objectContaining({
          event: "signup_rate_limited",
        })
      );
    });
  });

  describe("Error Response Format", () => {
    it("should return consistent error format when rate limited", async () => {
      mockCheckRateLimit.mockResolvedValue(false);

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(data).toEqual({
        error: "Too many sign-up attempts",
      });
    });
  });

  describe("Input Validation with Rate Limiting", () => {
    it("should not check rate limit when input validation fails", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "invalid-email",
          password: "short",
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      // Input validation happens before rate limit check
      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email or password");
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    it("should not check rate limit for malformed JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("Rate Limiting Configuration", () => {
    it("should use correct rate limiting configuration", () => {
      const { RATE_LIMIT_CONFIG } = require("../lib/auth/rate-limiter");

      expect(RATE_LIMIT_CONFIG.WINDOW_SECONDS).toBe(60);
      expect(RATE_LIMIT_CONFIG.MAX_REQUESTS).toBe(3);
      expect(RATE_LIMIT_CONFIG.KEY_PREFIX).toBe("rate_limit");
    });
  });
});
