import { NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmailService } from "@/lib/email/email-service";
import Stripe from "stripe";
import { PostHog } from "posthog-node";

// Extended Stripe types for properties that exist but aren't in the official types
interface ExtendedSubscription extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

interface ExtendedInvoice extends Stripe.Invoice {
  subscription: string;
  payment_intent: string;
}

// Initialize PostHog
const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
});

export async function POST(request: NextRequest) {
  try {
    // Get the raw body and signature
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
    }

    const rawBody = await request.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Verify webhook signature
    const stripeService = new StripeService();
    let event: Stripe.Event;

    try {
      event = stripeService.constructWebhookEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Check for duplicate event processing (idempotency)
    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("*")
      .eq("stripe_event_id", event.id)
      .single();

    if (existingEvent?.processed) {
      return NextResponse.json({ message: "Event already processed" }, { status: 200 });
    }

    // Insert or update the event record
    if (!existingEvent) {
      await supabase.from("webhook_events").insert({
        stripe_event_id: event.id,
        type: event.type,
        processed: false,
      });
    }

    // Process the event
    try {
      const emailService = new EmailService();

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // Get user_id from metadata
          const userId = session.metadata?.user_id;
          if (!userId) {
            throw new Error("Missing user_id in session metadata");
          }

          // Retrieve full session details
          const fullSession = await stripeService.retrieveCheckoutSession(session.id);

          if (fullSession.subscription && fullSession.payment_status === "paid") {
            // Get subscription details
            const subscription = await stripeService.retrieveSubscription(
              fullSession.subscription as string
            );

            // Get the plan from our database
            const priceId = subscription.items.data[0]?.price.id;
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("*")
              .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
              .single();

            // Create or update user subscription
            await supabase.from("user_subscriptions").upsert({
              user_id: userId,
              stripe_customer_id: fullSession.customer as string,
              stripe_subscription_id: subscription.id,
              plan_id: plan?.id,
              status: subscription.status,
              current_period_start: new Date(
                (subscription as ExtendedSubscription).current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                (subscription as ExtendedSubscription).current_period_end * 1000
              ).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end || false,
            });

            // Record payment
            await supabase.from("payment_history").insert({
              user_id: userId,
              stripe_payment_intent_id: fullSession.payment_intent as string,
              amount: fullSession.amount_total || 0,
              currency: fullSession.currency || "usd",
              status: "succeeded",
            });

            // Send confirmation email
            const { data: user } = await supabase.auth.admin.getUserById(userId);
            if (user?.user?.email) {
              await emailService.sendPaymentConfirmation(
                user.user.email,
                fullSession.amount_total || 0,
                fullSession.currency || "usd"
              );
            }

            // Track subscription created in PostHog
            posthog.capture({
              distinctId: userId,
              event: "subscription_created",
              properties: {
                plan_name: plan?.name,
                plan_tier: plan?.tier,
                price_id: priceId,
                amount: fullSession.amount_total || 0,
                currency: fullSession.currency || "usd",
                billing_interval: priceId === plan?.stripe_price_id_monthly ? "monthly" : "yearly",
                stripe_customer_id: fullSession.customer as string,
                stripe_subscription_id: subscription.id,
                subscription_status: subscription.status,
              },
            });

            // Update user properties in PostHog
            posthog.identify({
              distinctId: userId,
              properties: {
                subscription_tier: plan?.tier,
                subscription_status: subscription.status,
                is_paying_customer: true,
                customer_since: new Date().toISOString(),
              },
            });
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;

          // Get user info for tracking
          const { data: userSub } = await supabase
            .from("user_subscriptions")
            .select("user_id, plan_id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          // Update subscription status
          await supabase
            .from("user_subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(
                (subscription as ExtendedSubscription).current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                (subscription as ExtendedSubscription).current_period_end * 1000
              ).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);

          // Track subscription update in PostHog
          if (userSub?.user_id) {
            posthog.capture({
              distinctId: userSub.user_id,
              event: "subscription_updated",
              properties: {
                subscription_status: subscription.status,
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                stripe_subscription_id: subscription.id,
                update_type: subscription.cancel_at_period_end
                  ? "scheduled_cancellation"
                  : "reactivation",
              },
            });

            // Update user properties
            posthog.identify({
              distinctId: userSub.user_id,
              properties: {
                subscription_status: subscription.status,
                subscription_will_cancel: subscription.cancel_at_period_end || false,
              },
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;

          // Mark subscription as cancelled
          const { data: subData } = await supabase
            .from("user_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id)
            .select("user_id")
            .single();

          // Send cancellation email
          if (subData?.user_id) {
            const { data: user } = await supabase.auth.admin.getUserById(subData.user_id);
            if (user?.user?.email) {
              await emailService.sendSubscriptionCancelled(user.user.email);
            }

            // Track subscription cancellation in PostHog
            posthog.capture({
              distinctId: subData.user_id,
              event: "subscription_cancelled",
              properties: {
                stripe_subscription_id: subscription.id,
                cancellation_reason: subscription.cancellation_details?.reason || "unknown",
              },
            });

            // Update user properties
            posthog.identify({
              distinctId: subData.user_id,
              properties: {
                subscription_status: "cancelled",
                is_paying_customer: false,
                churned_at: new Date().toISOString(),
              },
            });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;

          // Get user from subscription
          const { data: subscription } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", (invoice as ExtendedInvoice).subscription)
            .single();

          if (subscription?.user_id) {
            // Record failed payment
            await supabase.from("payment_history").insert({
              user_id: subscription.user_id,
              stripe_payment_intent_id: (invoice as ExtendedInvoice).payment_intent as string,
              amount: invoice.amount_due,
              currency: invoice.currency,
              status: "failed",
            });

            // Send failure notification
            const { data: user } = await supabase.auth.admin.getUserById(subscription.user_id);
            if (user?.user?.email) {
              await emailService.sendPaymentFailed(user.user.email);
            }

            // Track payment failure in PostHog
            posthog.capture({
              distinctId: subscription.user_id,
              event: "payment_failed",
              properties: {
                amount: invoice.amount_due,
                currency: invoice.currency,
                stripe_payment_intent_id: (invoice as ExtendedInvoice).payment_intent,
                failure_reason: invoice.status_transitions?.finalized_at
                  ? "card_declined"
                  : "unknown",
              },
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await supabase
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", event.id);

      return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
      console.error("Error processing webhook:", error);

      // Record error in webhook_events
      await supabase
        .from("webhook_events")
        .update({
          error: error instanceof Error ? error.message : "Unknown error",
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", event.id);

      if (error instanceof Error && error.message.includes("user_id")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ error: "Error processing webhook" }, { status: 500 });
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
