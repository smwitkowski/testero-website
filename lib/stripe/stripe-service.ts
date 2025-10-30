import Stripe from "stripe";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is not defined in environment variables");
      throw new Error(
        "STRIPE_SECRET_KEY is not defined. Please configure Stripe in your environment variables."
      );
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Use the default API version from the Stripe dashboard
      // or specify a valid version via environment variable
      apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined,
      typescript: true,
    });
  }

  async createOrRetrieveCustomer(userId: string, email: string): Promise<Stripe.Customer> {
    try {
      // Search for existing customer with this Supabase user ID
      // Escape special characters in userId to prevent query issues
      const escapedUserId = userId.replace(/["\\]/g, "\\$&");
      const existingCustomers = await this.stripe.customers.search({
        query: `metadata["supabase_user_id"]:"${escapedUserId}"`,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          supabase_user_id: userId,
        },
      });

      return customer;
    } catch (error) {
      console.error("Error creating/retrieving customer:", error);
      throw new Error(
        `Failed to create or retrieve customer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Retrieve a price from Stripe and determine if it's a subscription or one-time payment
   */
  async getPriceType(priceId: string): Promise<"subscription" | "payment"> {
    try {
      const price = await this.stripe.prices.retrieve(priceId);
      return price.type === "recurring" ? "subscription" : "payment";
    } catch (error) {
      console.error("Error retrieving price:", error);
      throw new Error(
        `Failed to retrieve price: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async createCheckoutSession({
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    userId,
    mode,
  }: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    userId: string;
    mode?: "subscription" | "payment";
  }): Promise<Stripe.Checkout.Session> {
    try {
      // Determine mode if not provided
      const checkoutMode = mode || (await this.getPriceType(priceId));

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: checkoutMode,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
        },
        allow_promotion_codes: true,
      };

      // Only include subscription_data for subscription mode
      if (checkoutMode === "subscription") {
        sessionParams.subscription_data = {
          metadata: {
            user_id: userId,
          },
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);

      return session;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new Error(
        `Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      console.error("Error creating portal session:", error);
      throw new Error(
        `Failed to create portal session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      throw new Error("Invalid webhook signature");
    }
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });

      return subscription;
    } catch (error) {
      console.error("Error retrieving subscription:", error);
      throw new Error(
        `Failed to retrieve subscription: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      return subscription;
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      throw new Error(
        `Failed to cancel subscription: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "customer"],
      });

      return session;
    } catch (error) {
      console.error("Error retrieving checkout session:", error);
      throw new Error(
        `Failed to retrieve checkout session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async listCustomerSubscriptions(
    customerId: string
  ): Promise<Stripe.ApiList<Stripe.Subscription>> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        expand: ["data.items.data.price"],
      });

      return subscriptions;
    } catch (error) {
      console.error("Error listing customer subscriptions:", error);
      throw new Error("Failed to list customer subscriptions");
    }
  }

  async createTrialSubscription({
    customerId,
    priceId,
    trialDays = 14,
    userId,
  }: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    userId: string;
    promotionCode?: string; // Reserved for future use with checkout sessions
  }): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
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
      };

      // Note: Promotion codes can be applied via checkout session or customer portal
      // but not directly on subscription creation. For trials, we'll skip this for now.

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      return subscription;
    } catch (error) {
      console.error("Error creating trial subscription:", error);
      throw new Error(
        `Failed to create trial subscription: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async convertTrialToPaid(
    subscriptionId: string,
    paymentMethodId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        default_payment_method: paymentMethodId,
        trial_end: "now",
      });

      return subscription;
    } catch (error) {
      console.error("Error converting trial to paid:", error);
      throw new Error(
        `Failed to convert trial to paid: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
