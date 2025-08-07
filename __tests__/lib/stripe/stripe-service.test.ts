import { StripeService } from "@/lib/stripe/stripe-service";
import Stripe from "stripe";

// Mock Stripe
jest.mock("stripe");

describe("StripeService", () => {
  let stripeService: StripeService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    // Set up environment variable for test
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";

    jest.clearAllMocks();
    mockStripe = new Stripe("sk_test_mock", {
      apiVersion: "2025-07-30.basil",
    }) as jest.Mocked<Stripe>;
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe);
    stripeService = new StripeService();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("createOrRetrieveCustomer", () => {
    test("should create a new Stripe customer for new user", async () => {
      const userId = "user_123";
      const email = "test@example.com";
      const mockCustomer = {
        id: "cus_test123",
        email,
        metadata: { supabase_user_id: userId },
      } as unknown as Stripe.Customer;

      // Mock customer search returns empty
      mockStripe.customers = {
        ...mockStripe.customers,
        search: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue(mockCustomer),
      } as any;

      const customer = await stripeService.createOrRetrieveCustomer(userId, email);

      expect(mockStripe.customers.search).toHaveBeenCalledWith({
        query: `metadata["supabase_user_id"]:"${userId}"`,
      });
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        metadata: { supabase_user_id: userId },
      });
      expect(customer).toEqual(mockCustomer);
    });

    test("should return existing customer if already exists", async () => {
      const userId = "user_123";
      const email = "test@example.com";
      const mockCustomer = {
        id: "cus_existing",
        email,
        metadata: { supabase_user_id: userId },
      } as unknown as Stripe.Customer;

      // Mock customer search returns existing customer
      mockStripe.customers = {
        ...mockStripe.customers,
        search: jest.fn().mockResolvedValue({ data: [mockCustomer] }),
      } as any;

      const customer = await stripeService.createOrRetrieveCustomer(userId, email);

      expect(mockStripe.customers.search).toHaveBeenCalledWith({
        query: `metadata["supabase_user_id"]:"${userId}"`,
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(customer).toEqual(mockCustomer);
    });

    test("should handle Stripe API errors gracefully", async () => {
      const userId = "user_123";
      const email = "test@example.com";

      mockStripe.customers = {
        ...mockStripe.customers,
        search: jest.fn().mockRejectedValue(new Error("Stripe API error")),
      } as any;

      await expect(stripeService.createOrRetrieveCustomer(userId, email)).rejects.toThrow(
        "Failed to create or retrieve customer"
      );
    });
  });

  describe("createCheckoutSession", () => {
    test("should create checkout session for monthly subscription", async () => {
      const customerId = "cus_test123";
      const priceId = "price_monthly";
      const successUrl = "https://example.com/success";
      const cancelUrl = "https://example.com/cancel";
      const userId = "user_123";

      const mockSession = {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      } as Stripe.Checkout.Session;

      mockStripe.checkout = {
        sessions: {
          create: jest.fn().mockResolvedValue(mockSession),
        },
      } as any;

      const session = await stripeService.createCheckoutSession({
        customerId,
        priceId,
        successUrl,
        cancelUrl,
        userId,
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
        },
        subscription_data: {
          metadata: {
            user_id: userId,
          },
        },
        allow_promotion_codes: true,
      });

      expect(session).toEqual(mockSession);
    });

    test("should create checkout session for yearly subscription", async () => {
      const customerId = "cus_test123";
      const priceId = "price_yearly";
      const successUrl = "https://example.com/success";
      const cancelUrl = "https://example.com/cancel";
      const userId = "user_123";

      const mockSession = {
        id: "cs_test_yearly",
        url: "https://checkout.stripe.com/pay/cs_test_yearly",
      } as Stripe.Checkout.Session;

      mockStripe.checkout = {
        sessions: {
          create: jest.fn().mockResolvedValue(mockSession),
        },
      } as any;

      const session = await stripeService.createCheckoutSession({
        customerId,
        priceId,
        successUrl,
        cancelUrl,
        userId,
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
      expect(session).toEqual(mockSession);
    });

    test("should handle checkout session creation errors", async () => {
      const customerId = "cus_test123";
      const priceId = "price_invalid";
      const successUrl = "https://example.com/success";
      const cancelUrl = "https://example.com/cancel";
      const userId = "user_123";

      mockStripe.checkout = {
        sessions: {
          create: jest.fn().mockRejectedValue(new Error("Invalid price ID")),
        },
      } as any;

      await expect(
        stripeService.createCheckoutSession({
          customerId,
          priceId,
          successUrl,
          cancelUrl,
          userId,
        })
      ).rejects.toThrow("Failed to create checkout session");
    });
  });

  describe("createPortalSession", () => {
    test("should create billing portal session for customer", async () => {
      const customerId = "cus_test123";
      const returnUrl = "https://example.com/dashboard";

      const mockPortalSession = {
        id: "bps_test_123",
        url: "https://billing.stripe.com/session/test_123",
      } as Stripe.BillingPortal.Session;

      mockStripe.billingPortal = {
        sessions: {
          create: jest.fn().mockResolvedValue(mockPortalSession),
        },
      } as any;

      const session = await stripeService.createPortalSession(customerId, returnUrl);

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        return_url: returnUrl,
      });

      expect(session).toEqual(mockPortalSession);
    });

    test("should handle portal session creation errors", async () => {
      const customerId = "cus_invalid";
      const returnUrl = "https://example.com/dashboard";

      mockStripe.billingPortal = {
        sessions: {
          create: jest.fn().mockRejectedValue(new Error("Customer not found")),
        },
      } as any;

      await expect(stripeService.createPortalSession(customerId, returnUrl)).rejects.toThrow(
        "Failed to create portal session"
      );
    });
  });

  describe("constructWebhookEvent", () => {
    test("should construct and verify webhook event", () => {
      const payload = '{"type":"checkout.session.completed"}';
      const signature = "valid_signature";
      const secret = "whsec_test_secret";

      const mockEvent = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: { object: {} },
      } as Stripe.Event;

      mockStripe.webhooks = {
        constructEvent: jest.fn().mockReturnValue(mockEvent),
      } as any;

      const event = stripeService.constructWebhookEvent(payload, signature, secret);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, secret);
      expect(event).toEqual(mockEvent);
    });

    test("should throw error for invalid webhook signature", () => {
      const payload = '{"type":"checkout.session.completed"}';
      const signature = "invalid_signature";
      const secret = "whsec_test_secret";

      mockStripe.webhooks = {
        constructEvent: jest.fn().mockImplementation(() => {
          throw new Error("Invalid signature");
        }),
      } as any;

      expect(() => {
        stripeService.constructWebhookEvent(payload, signature, secret);
      }).toThrow("Invalid webhook signature");
    });
  });

  describe("retrieveSubscription", () => {
    test("should retrieve subscription details", async () => {
      const subscriptionId = "sub_test_123";
      const mockSubscription = {
        id: subscriptionId,
        status: "active",
        current_period_start: 1234567890,
        current_period_end: 1234567890,
        items: {
          data: [
            {
              price: {
                id: "price_123",
                recurring: {
                  interval: "month",
                },
              },
            },
          ],
        },
      } as unknown as Stripe.Subscription;

      mockStripe.subscriptions = {
        retrieve: jest.fn().mockResolvedValue(mockSubscription),
      } as any;

      const subscription = await stripeService.retrieveSubscription(subscriptionId);

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith(subscriptionId, {
        expand: ["items.data.price"],
      });
      expect(subscription).toEqual(mockSubscription);
    });

    test("should handle subscription retrieval errors", async () => {
      const subscriptionId = "sub_invalid";

      mockStripe.subscriptions = {
        retrieve: jest.fn().mockRejectedValue(new Error("Subscription not found")),
      } as any;

      await expect(stripeService.retrieveSubscription(subscriptionId)).rejects.toThrow(
        "Failed to retrieve subscription"
      );
    });
  });

  describe("cancelSubscription", () => {
    test("should cancel subscription at period end", async () => {
      const subscriptionId = "sub_test_123";
      const mockCancelledSubscription = {
        id: subscriptionId,
        status: "active",
        cancel_at_period_end: true,
      } as unknown as Stripe.Subscription;

      mockStripe.subscriptions = {
        update: jest.fn().mockResolvedValue(mockCancelledSubscription),
      } as any;

      const subscription = await stripeService.cancelSubscription(subscriptionId);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
        cancel_at_period_end: true,
      });
      expect(subscription).toEqual(mockCancelledSubscription);
    });

    test("should handle subscription cancellation errors", async () => {
      const subscriptionId = "sub_invalid";

      mockStripe.subscriptions = {
        update: jest.fn().mockRejectedValue(new Error("Subscription not found")),
      } as any;

      await expect(stripeService.cancelSubscription(subscriptionId)).rejects.toThrow(
        "Failed to cancel subscription"
      );
    });
  });
});
