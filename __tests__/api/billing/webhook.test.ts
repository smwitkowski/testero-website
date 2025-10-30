// Mock Next.js server runtime
jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    headers: {
      get: jest.fn((name) => init?.headers?.[name]),
    },
    text: jest.fn().mockResolvedValue(init?.body),
  })),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

import { POST } from "@/app/api/billing/webhook/route";
import { StripeService } from "@/lib/stripe/stripe-service";
import { EmailService } from "@/lib/email/email-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// Mock dependencies
jest.mock("@/lib/stripe/stripe-service");
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/email/email-service");

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("Stripe Webhook Handler", () => {
  let mockStripeService: jest.Mocked<StripeService>;
  let mockSupabase: any;
  let mockEmailService: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock StripeService
    mockStripeService = {
      constructWebhookEvent: jest.fn(),
      retrieveCheckoutSession: jest.fn(),
      retrieveSubscription: jest.fn(),
    } as any;
    (StripeService as jest.Mock).mockImplementation(() => mockStripeService);

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({ data: null }),
        },
      },
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockEmailService = {
      sendPaymentConfirmation: jest.fn(),
      sendSubscriptionCancelled: jest.fn(),
      sendPaymentFailed: jest.fn(),
    };
    (EmailService as jest.Mock).mockImplementation(() => mockEmailService);

    // Set environment variables
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("Webhook Signature Verification", () => {
    test("should verify webhook signature before processing", async () => {
      const payload = JSON.stringify({ type: "payment_intent.succeeded" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      // Mock raw body
      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockEvent = {
        id: "evt_test_123",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_123" } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const response = await POST(mockRequest);

      expect(mockStripeService.constructWebhookEvent).toHaveBeenCalledWith(
        payload,
        signature,
        "whsec_test_secret"
      );
      expect(response.status).toBe(200);
    });

    test("should reject invalid webhook signature", async () => {
      const payload = JSON.stringify({ type: "payment_intent.succeeded" });
      const signature = "invalid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      mockStripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error("Invalid webhook signature");
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("signature");
    });

    test("should return 400 if signature header is missing", async () => {
      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("signature");
    });
  });

  describe("Idempotency", () => {
    test("should prevent duplicate event processing", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockEvent = {
        id: "evt_duplicate",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_123" } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      // Simulate event already processed
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "existing_event", processed: true },
        error: null,
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toContain("already processed");
    });

    test("should track new events in webhook_events table", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockEvent = {
        id: "evt_new",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_123" } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      // Event doesn't exist yet
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing
        .mockResolvedValueOnce({ data: { id: "new_event" }, error: null }) // Insert
        .mockResolvedValueOnce({ data: { id: "new_event" }, error: null }); // Update as processed

      const response = await POST(mockRequest);

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        stripe_event_id: "evt_new",
        type: mockEvent.type,
        processed: false,
      });
      expect(response.status).toBe(200);
    });
  });

  describe("checkout.session.completed Event", () => {
    test("should create subscription record on successful checkout", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockSession = {
        id: "cs_test_123",
        customer: "cus_test_123",
        subscription: "sub_test_123",
        metadata: { user_id: "user_123" },
        amount_total: 2900,
        payment_status: "paid",
      };

      const mockSubscription = {
        id: "sub_test_123",
        status: "active",
        current_period_start: 1234567890,
        current_period_end: 1234567890,
        items: {
          data: [
            {
              price: {
                id: "price_123",
              },
            },
          ],
        },
      };

      const mockEvent = {
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: { object: mockSession },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      mockStripeService.retrieveCheckoutSession.mockResolvedValue(mockSession as any);
      mockStripeService.retrieveSubscription.mockResolvedValue(mockSubscription as any);

      // Mock database operations
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing event
        .mockResolvedValueOnce({ data: { id: "plan_123" }, error: null }) // Get plan
        .mockResolvedValueOnce({ data: { id: "sub_record" }, error: null }) // Upsert subscription
        .mockResolvedValueOnce({ data: { id: "payment_record" }, error: null }); // Update event as processed

      const response = await POST(mockRequest);

      // Verify subscription was created/updated
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user_123",
          stripe_customer_id: "cus_test_123",
          stripe_subscription_id: "sub_test_123",
          status: "active",
        })
      );

      expect(response.status).toBe(200);
    });

    test("should handle missing user_id in metadata", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockSession = {
        id: "cs_test_123",
        customer: "cus_test_123",
        subscription: "sub_test_123",
        metadata: {}, // Missing user_id
      };

      const mockEvent = {
        id: "evt_no_user",
        type: "checkout.session.completed",
        data: { object: mockSession },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing event
        .mockResolvedValueOnce({ data: { id: "evt_id" }, error: null }) // Insert event
        .mockResolvedValueOnce({
          data: { id: "evt_id" },
          error: null,
        }); // Update with error

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain("user_id");
    });
  });

  describe("customer.subscription.updated Event", () => {
    test("should update subscription status", async () => {
      const payload = JSON.stringify({ type: "customer.subscription.updated" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockSubscription = {
        id: "sub_test_123",
        status: "past_due",
        current_period_start: 1234567890,
        current_period_end: 1234567890,
        cancel_at_period_end: false,
      };

      const mockEvent = {
        id: "evt_sub_updated",
        type: "customer.subscription.updated",
        data: { object: mockSubscription },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing event
        .mockResolvedValueOnce({ data: { id: "evt_id" }, error: null }) // Insert event
        .mockResolvedValueOnce({ data: { id: "sub_record" }, error: null }) // Update subscription
        .mockResolvedValueOnce({ data: { id: "evt_id" }, error: null }); // Update event as processed

      const response = await POST(mockRequest);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "past_due",
          cancel_at_period_end: false,
        })
      );

      expect(response.status).toBe(200);
    });
  });

  describe("customer.subscription.deleted Event", () => {
    test("should mark subscription as cancelled", async () => {
      const payload = JSON.stringify({ type: "customer.subscription.deleted" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockSubscription = {
        id: "sub_test_123",
        status: "canceled",
      };

      const mockEvent = {
        id: "evt_sub_deleted",
        type: "customer.subscription.deleted",
        data: { object: mockSubscription },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing event
        .mockResolvedValueOnce({ data: { id: "evt_id" }, error: null }) // Insert event
        .mockResolvedValueOnce({ data: { id: "sub_record" }, error: null }) // Update subscription
        .mockResolvedValueOnce({ data: { id: "evt_id" }, error: null }); // Update event as processed

      const response = await POST(mockRequest);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "canceled",
        })
      );

      expect(response.status).toBe(200);
    });
  });

  describe("invoice.payment_failed Event", () => {
    test("should log payment failure", async () => {
      const payload = JSON.stringify({ type: "invoice.payment_failed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockInvoice = {
        id: "in_test_123",
        subscription: "sub_test_123",
        customer: "cus_test_123",
        payment_intent: "pi_test_123",
        amount_due: 2900,
      };

      const mockEvent = {
        id: "evt_payment_failed",
        type: "invoice.payment_failed",
        data: { object: mockInvoice },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      // Mock getting user from subscription
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check for existing event
        .mockResolvedValueOnce({
          data: { user_id: "user_123" },
          error: null,
        }); // Get subscription

      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { email: "user@example.com" } },
      });

      const response = await POST(mockRequest);

      expect(mockSupabase.insert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          stripe_payment_intent_id: "pi_test_123",
          status: "failed",
          amount: 2900,
        })
      );

      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });
      const signature = "valid_signature";

      mockRequest = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
        },
        body: payload,
      });

      mockRequest.text = jest.fn().mockResolvedValue(payload);

      const mockEvent = {
        id: "evt_db_error",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_123" } },
      } as any;

      mockStripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      // Simulate database error
      mockSupabase.single.mockRejectedValue(new Error("Database connection failed"));

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain("Internal server error");
    });
  });
});
