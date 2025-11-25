import { NextRequest } from "next/server";
import { GET } from "../app/auth/confirm/route";
import { createServerSupabaseClient } from "../lib/supabase/server";

// Mock the Supabase server client
jest.mock("../lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

describe("GET /auth/confirm", () => {
  let mockSupabaseClient: any;
  let mockVerifyOtp: jest.Mock;

  beforeEach(() => {
    mockVerifyOtp = jest.fn();
    mockSupabaseClient = {
      auth: {
        verifyOtp: mockVerifyOtp,
      },
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("successful verification", () => {
    it("should redirect to /dashboard when verification succeeds and no next param", async () => {
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        user: { id: "user-123", email: "test@example.com" },
      };

      mockVerifyOtp.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "email",
      });
    });

    it("should redirect to custom next URL when provided", async () => {
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        user: { id: "user-123", email: "test@example.com" },
      };

      mockVerifyOtp.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=signup&next=/verify-email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/verify-email");
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "email", // "signup" is normalized to "email" for Supabase verifyOtp
      });
    });

    it("should handle different valid types", async () => {
      const testCases = [
        { input: "email", expected: "email" },
        { input: "signup", expected: "email" }, // "signup" is normalized to "email"
        { input: "recovery", expected: "recovery" },
        { input: "magiclink", expected: "magiclink" },
        { input: "invite", expected: "invite" },
        { input: "email_change", expected: "email_change" },
      ];

      for (const { input, expected } of testCases) {
        const mockSession = {
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          user: { id: "user-123", email: "test@example.com" },
        };

        mockVerifyOtp.mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const request = new NextRequest(
          `http://localhost:3000/auth/confirm?token_hash=abc123&type=${input}`
        );

        const response = await GET(request);

        expect(response.status).toBe(307);
        expect(mockVerifyOtp).toHaveBeenCalledWith({
          token_hash: "abc123",
          type: expected, // Use expected normalized type
        });

        mockVerifyOtp.mockClear();
      }
    });
  });

  describe("missing parameters", () => {
    it("should redirect to login with error when token_hash is missing", async () => {
      const request = new NextRequest("http://localhost:3000/auth/confirm?type=email");

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("should redirect to login with error when type is missing", async () => {
      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("should redirect to login with error when both parameters are missing", async () => {
      const request = new NextRequest("http://localhost:3000/auth/confirm");

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });
  });

  describe("invalid type parameter", () => {
    it("should redirect to login with error when type is invalid", async () => {
      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=invalid_type"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });
  });

  describe("Supabase verification errors", () => {
    it("should redirect to login with error when verifyOtp returns an error", async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { session: null },
        error: { message: "Token has expired or is invalid" },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "email",
      });
    });

    it("should redirect to login with error when verifyOtp succeeds but returns no session", async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
    });
  });

  describe("security: redirect origin validation", () => {
    it("should prevent redirect to external origin", async () => {
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        user: { id: "user-123", email: "test@example.com" },
      };

      mockVerifyOtp.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Try to redirect to external site
      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email&next=https://evil.com/steal"
      );

      const response = await GET(request);

      // Should redirect to dashboard instead of external site
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });
  });

  describe("unexpected errors", () => {
    it("should handle unexpected errors gracefully", async () => {
      mockVerifyOtp.mockRejectedValue(new Error("Unexpected database error"));

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("verification_error=1");
    });
  });

  describe("redirect URL construction with NEXT_PUBLIC_SITE_URL", () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
      if (originalEnv) {
        process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
      } else {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      }
    });

    it("should use NEXT_PUBLIC_SITE_URL for redirects instead of request.url origin", async () => {
      // Set production URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";

      mockVerifyOtp.mockResolvedValue({
        data: { session: null },
        error: { message: "Token expired" },
      });

      // Request comes from internal container URL (simulating Cloud Run)
      const request = new NextRequest(
        "http://0.0.0.0:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://testero.ai/login?verification_error=1");
      // Verify it does NOT use the request.url origin
      expect(location).not.toContain("0.0.0.0");
    });

    it("should fallback to request.url origin when NEXT_PUBLIC_SITE_URL is not set", async () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;

      mockVerifyOtp.mockResolvedValue({
        data: { session: null },
        error: { message: "Token expired" },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=abc123&type=email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("http://localhost:3000/login?verification_error=1");
    });

    it("should use NEXT_PUBLIC_SITE_URL for successful redirects", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";

      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        user: { id: "user-123", email: "test@example.com" },
      };

      mockVerifyOtp.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Request from internal URL
      const request = new NextRequest(
        "http://0.0.0.0:3000/auth/confirm?token_hash=abc123&type=email&next=/verify-email"
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://testero.ai/verify-email");
      expect(location).not.toContain("0.0.0.0");
    });
  });
});

