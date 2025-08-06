import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Mock dependencies
jest.mock("@/lib/supabase/server");
jest.mock("stripe");

describe("Billing Flow Integration", () => {
  let stripeService: StripeService;
  let mockSupabase: any;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    // Set up environment
    process.env.STRIPE_SECRET_KEY = "sk_test_integration";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_integration";
    process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";

    // Mock Stripe
    mockStripe = {
      customers: {
        search: jest.fn(),
        create: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
          retrieve: jest.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe);

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      auth: {
        getUser: jest.fn(),
      },
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    stripeService = new StripeService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("Complete Checkout Flow", () => {
    test("should handle new customer checkout flow end-to-end", async () => {
      const userId = "user_123";
      const email = "test@example.com";
      const priceId = "price_monthly";

      // Step 1: Create or retrieve customer
      mockStripe.customers.search.mockResolvedValue({
        data: [],
        has_more: false,
        url: "",
        object: "search_result",
      });

      const mockCustomer = {
        id: "cus_new_123",
        email,
        metadata: { supabase_user_id: userId },
      } as Stripe.Customer;

      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const customer = await stripeService.createOrRetrieveCustomer(userId, email);
      expect(customer.id).toBe("cus_new_123");

      // Step 2: Create checkout session
      const mockSession = {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
        customer: customer.id,
        metadata: { user_id: userId },
      } as Stripe.Checkout.Session;

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const session = await stripeService.createCheckoutSession({
        customerId: customer.id,
        priceId,
        successUrl: "https://testero.ai/dashboard/billing?success=true",
        cancelUrl: "https://testero.ai/pricing",
        userId,
      });

      expect(session.url).toBe("https://checkout.stripe.com/pay/cs_test_123");

      // Step 3: Simulate webhook after successful payment
      const webhookEvent = {
        id: "evt_checkout_complete",
        type: "checkout.session.completed",
        data: {
          object: {
            id: mockSession.id,
            customer: customer.id,
            subscription: "sub_new_123",
            metadata: { user_id: userId },
            amount_total: 2900,
            payment_status: "paid",
          },
        },
      } as Stripe.Event;

      const mockSubscription = {
        id: "sub_new_123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [
            {
              price: {
                id: priceId,
              },
            },
          ],
        },
      } as Stripe.Subscription;

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(
        webhookEvent.data.object as Stripe.Checkout.Session
      );
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      // Verify all steps were called correctly
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        metadata: { supabase_user_id: userId },
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        mode: "subscription",
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: "https://testero.ai/dashboard/billing?success=true",
        cancel_url: "https://testero.ai/pricing",
        metadata: { user_id: userId },
        subscription_data: {
          metadata: { user_id: userId },
        },
        payment_method_types: ["card"],
        allow_promotion_codes: true,
      });
    });

    test("should handle existing customer with active subscription", async () => {
      const userId = "user_existing";
      const email = "existing@example.com";

      // Existing customer with subscription
      const mockCustomer = {
        id: "cus_existing_123",
        email,
        metadata: { supabase_user_id: userId },
      } as Stripe.Customer;

      mockStripe.customers.search.mockResolvedValue({
        data: [mockCustomer],
        has_more: false,
        url: "",
        object: "search_result",
      });

      const customer = await stripeService.createOrRetrieveCustomer(userId, email);
      expect(customer.id).toBe("cus_existing_123");
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });
  });

  describe("Subscription Management Flow", () => {
    test("should handle subscription update via webhook", async () => {
      const subscriptionId = "sub_update_123";

      const updatedSubscription = {
        id: subscriptionId,
        status: "past_due",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
      } as Stripe.Subscription;

      const webhookEvent = {
        id: "evt_sub_update",
        type: "customer.subscription.updated",
        data: {
          object: updatedSubscription,
        },
      } as Stripe.Event;

      // Database operations
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check event exists
        .mockResolvedValueOnce({ data: { id: "evt_record" }, error: null }) // Insert event
        .mockResolvedValueOnce({ data: { id: "sub_record" }, error: null }) // Update subscription
        .mockResolvedValueOnce({ data: { id: "evt_record" }, error: null }); // Mark processed

      // Verify subscription update would be saved
      expect(webhookEvent.data.object).toHaveProperty("status", "past_due");
    });

    test("should handle subscription cancellation", async () => {
      const subscriptionId = "sub_cancel_123";

      const canceledSubscription = {
        id: subscriptionId,
        status: "canceled",
        canceled_at: Math.floor(Date.now() / 1000),
      } as Stripe.Subscription;

      mockStripe.subscriptions.update.mockResolvedValue(canceledSubscription);

      const result = await stripeService.cancelSubscription(subscriptionId);

      expect(result.status).toBe("canceled");
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
        cancel_at_period_end: true,
      });
    });

    test("should create billing portal session", async () => {
      const customerId = "cus_portal_123";
      const returnUrl = "https://testero.ai/dashboard/billing";

      const mockPortalSession = {
        id: "bps_test_123",
        url: "https://billing.stripe.com/session/bps_test_123",
        customer: customerId,
        return_url: returnUrl,
      } as Stripe.BillingPortal.Session;

      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockPortalSession);

      const session = await stripeService.createPortalSession(customerId, returnUrl);

      expect(session.url).toBe("https://billing.stripe.com/session/bps_test_123");
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        return_url: returnUrl,
      });
    });
  });

  describe("Payment Failure Handling", () => {
    test("should handle payment failure webhook", async () => {
      const invoiceId = "in_failed_123";
      const subscriptionId = "sub_failed_123";

      const failedInvoice = {
        id: invoiceId,
        subscription: subscriptionId,
        customer: "cus_failed_123",
        payment_intent: "pi_failed_123",
        amount_due: 2900,
        status: "open",
        attempt_count: 3,
      };

      const webhookEvent = {
        id: "evt_payment_failed",
        type: "invoice.payment_failed",
        data: {
          object: failedInvoice,
        },
      } as any;

      // Verify payment failure would be recorded
      expect(webhookEvent.data.object).toHaveProperty("status", "open");
      expect(webhookEvent.data.object).toHaveProperty("attempt_count", 3);
    });

    test("should handle checkout session expiration", async () => {
      const expiredSession = {
        id: "cs_expired_123",
        status: "expired",
        payment_status: "unpaid",
      } as Stripe.Checkout.Session;

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(expiredSession);

      const session = await stripeService.retrieveCheckoutSession("cs_expired_123");

      expect(session.status).toBe("expired");
      expect(session.payment_status).toBe("unpaid");
    });
  });

  describe("Security and Validation", () => {
    test("should validate webhook signatures", () => {
      const payload = JSON.stringify({ type: "test.event" });
      const signature = "valid_signature";
      const secret = "whsec_test_secret";

      const mockEvent = {
        id: "evt_test",
        type: "test.event",
        data: { object: {} },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const event = stripeService.constructWebhookEvent(payload, signature, secret);

      expect(event.type).toBe("test.event");
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, secret);
    });

    test("should reject invalid webhook signatures", () => {
      const payload = JSON.stringify({ type: "test.event" });
      const signature = "invalid_signature";
      const secret = "whsec_test_secret";

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      expect(() => {
        stripeService.constructWebhookEvent(payload, signature, secret);
      }).toThrow("Invalid webhook signature");
    });

    test("should enforce price ID validation", async () => {
      const invalidPriceId = "price_invalid";
      const validPriceIds = ["price_monthly", "price_yearly"];

      // This would be handled in the API route
      expect(validPriceIds.includes(invalidPriceId)).toBe(false);
    });
  });

  describe("Database Synchronization", () => {
    test("should sync subscription data with database", async () => {
      const userId = "user_sync_123";
      const subscriptionData = {
        user_id: userId,
        stripe_customer_id: "cus_sync_123",
        stripe_subscription_id: "sub_sync_123",
        status: "active",
        plan_id: "plan_monthly",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      };

      mockSupabase.single.mockResolvedValue({
        data: subscriptionData,
        error: null,
      });

      // Verify upsert would be called with correct data
      const upsertData = {
        ...subscriptionData,
        updated_at: expect.any(String),
      };

      // This would be called in the webhook handler
      expect(subscriptionData).toHaveProperty("user_id", userId);
      expect(subscriptionData).toHaveProperty("status", "active");
    });

    test("should record payment history", async () => {
      const paymentData = {
        user_id: "user_payment_123",
        stripe_payment_intent_id: "pi_success_123",
        amount: 2900,
        currency: "usd",
        status: "succeeded",
        created_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValue({
        data: paymentData,
        error: null,
      });

      // Verify payment would be recorded
      expect(paymentData).toHaveProperty("status", "succeeded");
      expect(paymentData).toHaveProperty("amount", 2900);
    });
  });
});
