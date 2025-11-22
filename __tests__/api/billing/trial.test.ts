/**
 * Comprehensive tests for the trial API endpoint
 * Verifies trial creation defaults, tier selection, and business logic
 */

// Mock Next.js server runtime
jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    headers: {
      get: jest.fn((name) => init?.headers?.[name]),
    },
    text: jest.fn().mockResolvedValue(init?.body || ""),
  })),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from "@/app/api/billing/trial/route";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// Mock dependencies
jest.mock("@/lib/stripe/stripe-service");
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/rate-limiter");
jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    shutdown: jest.fn(),
  })),
}));

describe("Trial API Endpoint", () => {
  let mockStripeService: jest.Mocked<StripeService>;
  let mockSupabase: any;
  let mockRequest: NextRequest;
  const mockPostHogCapture = jest.fn();
  const mockPostHogShutdown = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock StripeService
    mockStripeService = {
      createOrRetrieveCustomer: jest.fn(),
      createTrialSubscription: jest.fn(),
    } as any;
    (StripeService as jest.Mock).mockImplementation(() => mockStripeService);

    // Mock Supabase
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock rate limiter
    (checkRateLimit as jest.Mock).mockResolvedValue(true);

    // Mock PostHog
    const PostHog = require("posthog-node").PostHog;
    (PostHog as jest.Mock).mockImplementation(() => ({
      capture: mockPostHogCapture,
      shutdown: mockPostHogShutdown,
    }));

    // Set environment variables
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY = "price_pro_monthly_test";
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "ph_test_key";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toContain("authenticated");
    });

    it("should allow authenticated users", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60; // 14 days from now
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe("ok");
      expect(responseData.subscriptionId).toBe("sub_test_123");
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limiting", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (checkRateLimit as jest.Mock).mockResolvedValue(false);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(429);
      expect(responseData.error).toContain("Too many requests");
    });
  });

  describe("Default Trial Behavior", () => {
    it("should default to Pro Monthly when no priceId provided", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      // Verify createTrialSubscription was called with Pro Monthly price ID
      expect(mockStripeService.createTrialSubscription).toHaveBeenCalledWith({
        customerId: "cus_test_123",
        priceId: "price_pro_monthly_test", // From env var
        trialDays: 14,
        userId: "user_123",
      });
    });

    it("should use fallback price ID when env var not set", async () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY;

      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      // Verify fallback price ID is used
      expect(mockStripeService.createTrialSubscription).toHaveBeenCalledWith({
        customerId: "cus_test_123",
        priceId: "price_pro_monthly", // Fallback value
        trialDays: 14,
        userId: "user_123",
      });
    });
  });

  describe("Tier Selection", () => {
    it("should allow selecting Basic tier via priceId", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_basic_monthly_test" }),
      });

      await POST(mockRequest);

      // Verify Basic tier price ID was used
      expect(mockStripeService.createTrialSubscription).toHaveBeenCalledWith({
        customerId: "cus_test_123",
        priceId: "price_basic_monthly_test",
        trialDays: 14,
        userId: "user_123",
      });
    });

    it("should allow selecting All-Access tier via priceId", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_all_access_monthly_test" }),
      });

      await POST(mockRequest);

      // Verify All-Access tier price ID was used
      expect(mockStripeService.createTrialSubscription).toHaveBeenCalledWith({
        customerId: "cus_test_123",
        priceId: "price_all_access_monthly_test",
        trialDays: 14,
        userId: "user_123",
      });
    });
  });

  describe("Duplicate Trial Prevention", () => {
    it("should prevent trial if user has subscription history showing trial was used", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: subscription history shows trial was used (trial_ends_at set, status not trialing)
      mockSupabase.limit.mockResolvedValueOnce({
        data: [
          {
            id: "sub_123",
            status: "canceled",
            trial_ends_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            stripe_subscription_id: "sub_stripe_123",
          },
        ],
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("already used your free trial");
      expect(mockStripeService.createTrialSubscription).not.toHaveBeenCalled();
    });

    it("should allow trial if user has metadata=true but no subscription history (clears metadata)", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {
          has_used_trial: true,
        },
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock successful trial creation
      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      // Should succeed - metadata cleared and trial created
      expect(response.status).toBe(200);
      expect(responseData.status).toBe("ok");
      // Verify metadata was cleared first, then set to true after trial creation
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledTimes(2);
      expect(mockSupabase.auth.updateUser).toHaveBeenNthCalledWith(1, {
        data: { has_used_trial: false },
      });
      expect(mockSupabase.auth.updateUser).toHaveBeenNthCalledWith(2, {
        data: { has_used_trial: true },
      });
    });

    it("should prevent trial if metadata=true AND subscription history confirms trial was used", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {
          has_used_trial: true,
        },
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: subscription history shows trial was used
      mockSupabase.limit.mockResolvedValueOnce({
        data: [
          {
            id: "sub_123",
            status: "active",
            trial_ends_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            stripe_subscription_id: "sub_stripe_123",
          },
        ],
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("already used your free trial");
      expect(mockStripeService.createTrialSubscription).not.toHaveBeenCalled();
    });
  });

  describe("Active Subscription Prevention", () => {
    it("should prevent trial if user has active subscription", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: active subscription found
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "sub_existing",
          status: "active",
          user_id: "user_123",
        },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("already have an active subscription");
      expect(mockStripeService.createTrialSubscription).not.toHaveBeenCalled();
    });

    it("should prevent trial if user has trialing subscription", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: trialing subscription found
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "sub_existing",
          status: "trialing",
          user_id: "user_123",
        },
        error: null,
      });

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("already have an active subscription");
      expect(mockStripeService.createTrialSubscription).not.toHaveBeenCalled();
    });

    it("should handle database query errors gracefully and continue", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: database error when checking active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection error" },
      });

      // Mock: no subscription history (or error here too)
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock successful trial creation
      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      // Should succeed despite query error (logged but doesn't block)
      expect(response.status).toBe(200);
      expect(responseData.status).toBe("ok");
    });
  });

  describe("Trial Subscription Creation", () => {
    it("should create subscription with 14-day trial period", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      // Verify 14-day trial period
      expect(mockStripeService.createTrialSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          trialDays: 14,
        })
      );
    });

    it("should return subscription with trialing status", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe("ok");
      expect(responseData.subscriptionId).toBe("sub_test_123");
      expect(responseData.trialEndsAt).toBeDefined();
    });
  });

  describe("Database Persistence", () => {
    it("should insert subscription record with trialing status", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const trialEndDate = new Date(trialEnd * 1000).toISOString();
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      // Verify database insert was called
      expect(mockSupabase.from).toHaveBeenCalledWith("user_subscriptions");
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user_123",
          stripe_customer_id: "cus_test_123",
          stripe_subscription_id: "sub_test_123",
          status: "trialing",
          plan_id: null,
          trial_ends_at: trialEndDate,
        })
      );
    });

    it("should set trial_ends_at to correct timestamp", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const now = Math.floor(Date.now() / 1000);
      const trialEnd = now + 14 * 24 * 60 * 60; // 14 days
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      const expectedTrialEndsAt = new Date(trialEnd * 1000).toISOString();

      // Verify trial_ends_at is within 1 second of expected value (allowing for execution time)
      const actualTrialEndsAt = new Date(insertCall.trial_ends_at).getTime();
      const expectedTrialEndsAtTime = new Date(expectedTrialEndsAt).getTime();
      const diff = Math.abs(actualTrialEndsAt - expectedTrialEndsAtTime);

      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe("User Metadata Updates", () => {
    it("should set has_used_trial flag to true after successful trial creation", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      await POST(mockRequest);

      // Verify user metadata was updated
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: { has_used_trial: true },
      });
    });
  });

  describe("Analytics Tracking", () => {
    it("should track trial_started event", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock: no active subscription
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: no subscription history
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const mockSubscription = {
        id: "sub_test_123",
        status: "trialing",
        trial_end: trialEnd,
      } as Stripe.Subscription;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockResolvedValue(mockSubscription);

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ anonymousSessionId: "anon_123" }),
      });

      await POST(mockRequest);

      // Verify PostHog event was captured
      expect(mockPostHogCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "user_123",
          event: "trial_started",
          properties: expect.objectContaining({
            email: "test@example.com",
            trial_days: 14,
            price_id: "price_pro_monthly_test",
            from_anonymous: true,
            anonymous_session_id: "anon_123",
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Stripe service errors gracefully", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockRejectedValue(
        new Error("STRIPE_SECRET_KEY is required")
      );

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(503);
      expect(responseData.error).toContain("Payment system not configured");
    });

    it("should handle invalid price ID errors", async () => {
      const mockUser = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: {},
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCustomer = {
        id: "cus_test_123",
        email: mockUser.email,
      } as Stripe.Customer;

      mockStripeService.createOrRetrieveCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createTrialSubscription.mockRejectedValue(
        new Error("Price price_invalid does not exist")
      );

      mockRequest = new NextRequest("http://localhost:3000/api/billing/trial", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_invalid" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("Invalid subscription plan");
    });
  });
});
