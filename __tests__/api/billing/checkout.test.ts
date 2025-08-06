// Mock Next.js server runtime
jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    headers: {
      get: jest.fn((name) => init?.headers?.[name]),
    },
    json: jest.fn().mockResolvedValue(init?.body),
  })),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

import { POST } from "@/app/api/billing/checkout/route";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// Mock dependencies
jest.mock("@/lib/stripe/stripe-service");
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/rate-limiter");

describe("Checkout Session API", () => {
  let mockStripeService: jest.Mocked<StripeService>;
  let mockSupabase: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock StripeService
    mockStripeService = {
      createOrRetrieveCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
    } as any;
    (StripeService as jest.Mock).mockImplementation(() => mockStripeService);

    // Mock Supabase
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock rate limiter
    (checkRateLimit as jest.Mock).mockResolvedValue(true);

    // Set environment variables
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";
    process.env.STRIPE_PRICE_ID_MONTHLY = "price_monthly";
    process.env.STRIPE_PRICE_ID_YEARLY = "price_yearly";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.STRIPE_PRICE_ID_MONTHLY;
    delete process.env.STRIPE_PRICE_ID_YEARLY;
  });

  describe("Authentication", () => {
    test("should require authentication", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toContain("authenticated");
    });

    test("should allow authenticated users", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const mockSession = {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      } as Stripe.Checkout.Session;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createCheckoutSession.mockResolvedValue(mockSession);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.url).toBe(mockSession.url);
    });
  });

  describe("Rate Limiting", () => {
    test("should enforce rate limiting", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (checkRateLimit as jest.Mock).mockResolvedValue(false);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(429);
      expect(responseData.error).toContain("Too many requests");
    });
  });

  describe("Checkout Session Creation", () => {
    test("should create checkout session for monthly subscription", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const mockSession = {
        id: "cs_test_monthly",
        url: "https://checkout.stripe.com/pay/cs_test_monthly",
      } as Stripe.Checkout.Session;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createCheckoutSession.mockResolvedValue(mockSession);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(mockStripeService.createOrRetrieveCustomer).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email
      );

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith({
        customerId: mockCustomer.id,
        priceId: "price_monthly",
        successUrl: "https://testero.ai/dashboard/billing?success=true",
        cancelUrl: "https://testero.ai/pricing",
        userId: mockUser.id,
      });

      expect(response.status).toBe(200);
      expect(responseData.url).toBe(mockSession.url);
    });

    test("should create checkout session for yearly subscription", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const mockSession = {
        id: "cs_test_yearly",
        url: "https://checkout.stripe.com/pay/cs_test_yearly",
      } as Stripe.Checkout.Session;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createCheckoutSession.mockResolvedValue(mockSession);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_yearly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith({
        customerId: mockCustomer.id,
        priceId: "price_yearly",
        successUrl: "https://testero.ai/dashboard/billing?success=true",
        cancelUrl: "https://testero.ai/pricing",
        userId: mockUser.id,
      });

      expect(response.status).toBe(200);
      expect(responseData.url).toBe(mockSession.url);
    });

    test("should reject invalid price ID", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_invalid" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("Invalid price");
    });

    test("should not allow checkout if user already has active subscription", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock existing active subscription
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "sub_existing",
          status: "active",
        },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("already have an active subscription");
    });
  });

  describe("Error Handling", () => {
    test("should handle Stripe API errors", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      mockStripeService.createOrRetrieveCustomer.mockRejectedValue(new Error("Stripe API error"));

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_monthly" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain("checkout session");
    });

    test("should validate request body", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({}), // Missing priceId
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("price");
    });
  });
});
