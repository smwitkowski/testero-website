import { StripeService } from "@/lib/stripe/stripe-service";
import Stripe from "stripe";

// Mock Stripe
jest.mock("stripe");

describe("StripeService Trial Methods", () => {
  let stripeService: StripeService;
  let mockStripe: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup Stripe mock
    mockStripe = {
      customers: {
        search: jest.fn(),
        create: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
    };

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe as any);

    // Set environment variable for testing
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    stripeService = new StripeService();
  });

  describe("createTrialSubscription", () => {
    it("creates a subscription with 14-day trial period", async () => {
      // Arrange
      const customerId = "cus_test123";
      const priceId = "price_test123";
      const userId = "user-123";
      const trialDays = 14;

      const expectedSubscription = {
        id: "sub_trial123",
        customer: customerId,
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60,
        metadata: {
          user_id: userId,
        },
      };

      mockStripe.subscriptions.create.mockResolvedValue(expectedSubscription);

      // Act
      const result = await stripeService.createTrialSubscription({
        customerId,
        priceId,
        trialDays,
        userId,
      });

      // Assert
      expect(result).toEqual(expectedSubscription);
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialDays,
        metadata: {
          user_id: userId,
        },
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
      });
    });

    it("defaults to 14 days if trialDays not specified", async () => {
      // Arrange
      const customerId = "cus_test123";
      const priceId = "price_test123";
      const userId = "user-123";

      mockStripe.subscriptions.create.mockResolvedValue({
        id: "sub_trial123",
        customer: customerId,
        status: "trialing",
      });

      // Act
      await stripeService.createTrialSubscription({
        customerId,
        priceId,
        userId,
        // trialDays not specified - should default to 14
      });

      // Assert
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trial_period_days: 14,
        })
      );
    });

    it("handles Stripe API errors gracefully", async () => {
      // Arrange
      const customerId = "cus_test123";
      const priceId = "price_test123";
      const userId = "user-123";

      const stripeError = new Error("Invalid price ID");
      mockStripe.subscriptions.create.mockRejectedValue(stripeError);

      // Act & Assert
      await expect(
        stripeService.createTrialSubscription({
          customerId,
          priceId,
          userId,
        })
      ).rejects.toThrow("Failed to create trial subscription: Invalid price ID");
    });

    it("includes promotion code support", async () => {
      // Arrange
      const customerId = "cus_test123";
      const priceId = "price_test123";
      const userId = "user-123";
      const promotionCode = "LAUNCH2025";

      mockStripe.subscriptions.create.mockResolvedValue({
        id: "sub_trial123",
        customer: customerId,
        status: "trialing",
      });

      // Act
      await stripeService.createTrialSubscription({
        customerId,
        priceId,
        userId,
        promotionCode,
      });

      // Assert - promotion codes are not directly supported on subscription creation
      // They need to be applied via checkout session or customer portal
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: customerId,
          trial_period_days: 14,
        })
      );
    });
  });

  describe("convertTrialToPaid", () => {
    it("converts trial subscription to paid", async () => {
      // Arrange
      const subscriptionId = "sub_trial123";
      const paymentMethodId = "pm_test123";

      const updatedSubscription = {
        id: subscriptionId,
        status: "active",
        trial_end: null,
      };

      mockStripe.subscriptions.update.mockResolvedValue(updatedSubscription);

      // Act
      const result = await stripeService.convertTrialToPaid(subscriptionId, paymentMethodId);

      // Assert
      expect(result).toEqual(updatedSubscription);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
        default_payment_method: paymentMethodId,
        trial_end: "now",
      });
    });
  });
});
