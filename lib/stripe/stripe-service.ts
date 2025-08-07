import Stripe from "stripe";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined");
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
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

  async createCheckoutSession({
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    userId,
  }: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    userId: string;
  }): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
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
}
