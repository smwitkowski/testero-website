/** @jest-environment node */
import { NextRequest } from "next/server";
import { signGraceCookie, verifyGraceCookie } from "@/lib/billing/grace-cookie";

describe("grace-cookie", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.PAYWALL_SIGNING_SECRET = "test-secret-key-for-signing";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("signGraceCookie", () => {
    it("should create a cookie with correct options", () => {
      const cookie = signGraceCookie();

      expect(cookie.name).toBe("checkout_grace");
      expect(cookie.options).toMatchObject({
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 900, // 15 minutes
      });
      expect(cookie.value).toBeTruthy();
    });

    it("should create different values on each call", () => {
      jest.useFakeTimers();
      const cookie1 = signGraceCookie();
      jest.advanceTimersByTime(1000); // Advance 1 second
      const cookie2 = signGraceCookie();

      expect(cookie1.value).not.toBe(cookie2.value);
      jest.useRealTimers();
    });
  });

  describe("verifyGraceCookie", () => {
    it("should return true for a valid signed cookie", () => {
      const cookie = signGraceCookie();
      const req = new NextRequest("https://example.com", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      });

      const result = verifyGraceCookie(req);
      expect(result).toBe(true);
    });

    it("should return false for an expired cookie", () => {
      jest.useFakeTimers();
      const cookie = signGraceCookie();

      // Advance time by 16 minutes (past 15 minute TTL)
      jest.advanceTimersByTime(16 * 60 * 1000);

      const req = new NextRequest("https://example.com", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      });

      const result = verifyGraceCookie(req);
      expect(result).toBe(false);

      jest.useRealTimers();
    });

    it("should return false for a tampered cookie", () => {
      const cookie = signGraceCookie();
      const tamperedValue = cookie.value.slice(0, -5) + "xxxxx";
      const req = new NextRequest("https://example.com", {
        headers: {
          cookie: `${cookie.name}=${tamperedValue}`,
        },
      });

      const result = verifyGraceCookie(req);
      expect(result).toBe(false);
    });

    it("should return false when cookie is missing", () => {
      const req = new NextRequest("https://example.com");
      const result = verifyGraceCookie(req);
      expect(result).toBe(false);
    });

    it("should return false when signing secret is missing", () => {
      // Create cookie with secret first
      const cookie = signGraceCookie();
      
      // Remove secret before verification
      delete process.env.PAYWALL_SIGNING_SECRET;
      
      const req = new NextRequest("https://example.com", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      });

      const result = verifyGraceCookie(req);
      expect(result).toBe(false);
      
      // Restore secret for other tests
      process.env.PAYWALL_SIGNING_SECRET = "test-secret-key-for-signing";
    });

    it("should work with standard Request object", () => {
      const cookie = signGraceCookie();
      const req = new Request("https://example.com", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      });

      const result = verifyGraceCookie(req);
      expect(result).toBe(true);
    });
  });
});

