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
const posthog = (() => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  return new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  });
})();

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

      // Log event received
      console.log(`[Webhook] Processing event: ${event.type} (id: ${event.id})`);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // Get user_id from metadata
          const userId = session.metadata?.user_id;
          if (!userId) {
            console.error(`[Webhook] Missing user_id in session metadata for event ${event.id}`);
            throw new Error("Missing user_id in session metadata");
          }

          // Retrieve full session details
          const fullSession = await stripeService.retrieveCheckoutSession(session.id);

          if (fullSession.payment_status === "paid") {
            // Check session mode to determine payment type
            if (fullSession.mode === "subscription" && fullSession.subscription) {
              // Subscription payment
              console.log(
                `[Webhook] Processing subscription checkout for user ${userId}, subscription ${fullSession.subscription}`
              );

              // Get subscription details
              const subscription = await stripeService.retrieveSubscription(
                fullSession.subscription as string
              );

              // Get the plan from our database
              const priceId = subscription.items.data[0]?.price.id;
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("*")
              .or(
                `stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId},stripe_price_id_three_month.eq.${priceId}`
              )
              .single();

              // Create or update user subscription
              const { error: subError } = await supabase.from("user_subscriptions").upsert({
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

              if (subError) {
                console.error(
                  `[Webhook] Error upserting subscription for user ${userId}:`,
                  subError
                );
                throw subError;
              }

              // Record payment with idempotency
              if (fullSession.payment_intent) {
                const { error: paymentError } = await supabase
                  .from("payment_history")
                  .upsert(
                    {
                      user_id: userId,
                      stripe_payment_intent_id: fullSession.payment_intent as string,
                      amount: fullSession.amount_total || 0,
                      currency: fullSession.currency || "usd",
                      status: "succeeded",
                      receipt_url: null, // Will be populated by payment_intent.succeeded if available
                    },
                    { onConflict: "stripe_payment_intent_id" }
                  );

                if (paymentError) {
                  console.error(
                    `[Webhook] Error upserting payment history for payment intent ${fullSession.payment_intent}:`,
                    paymentError
                  );
                } else {
                  console.log(
                    `[Webhook] Successfully recorded subscription payment for user ${userId}, payment intent ${fullSession.payment_intent}`
                  );
                }
              }

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
              posthog?.capture({
                distinctId: userId,
                event: "subscription_created",
                properties: {
                  plan_name: plan?.name,
                  plan_tier: plan?.tier,
                  price_id: priceId,
                  amount: fullSession.amount_total || 0,
                  currency: fullSession.currency || "usd",
                  billing_interval:
                    priceId === plan?.stripe_price_id_monthly
                      ? "monthly"
                      : priceId === plan?.stripe_price_id_three_month
                        ? "three_month"
                        : "yearly",
                  stripe_customer_id: fullSession.customer as string,
                  stripe_subscription_id: subscription.id,
                  subscription_status: subscription.status,
                },
              });

              // Update user properties in PostHog
              posthog?.identify({
                distinctId: userId,
                properties: {
                  subscription_tier: plan?.tier,
                  subscription_status: subscription.status,
                  is_paying_customer: true,
                  customer_since: new Date().toISOString(),
                },
              });
            } else if (fullSession.mode === "payment" && fullSession.payment_intent) {
              // One-time payment
              console.log(
                `[Webhook] Processing one-time payment checkout for user ${userId}, payment intent ${fullSession.payment_intent}`
              );

              // Record payment in payment_history with idempotency
              const { error: paymentError } = await supabase
                .from("payment_history")
                .upsert(
                  {
                    user_id: userId,
                    stripe_payment_intent_id: fullSession.payment_intent as string,
                    amount: fullSession.amount_total || 0,
                    currency: fullSession.currency || "usd",
                    status: "succeeded",
                    receipt_url: null, // Will be populated by payment_intent.succeeded if available
                  },
                  { onConflict: "stripe_payment_intent_id" }
                );

              if (paymentError) {
                console.error(
                  `[Webhook] Error upserting payment history for payment intent ${fullSession.payment_intent}:`,
                  paymentError
                );
              } else {
                console.log(
                  `[Webhook] Successfully recorded one-time payment for user ${userId}, payment intent ${fullSession.payment_intent}`
                );
              }

              // Send confirmation email
              const { data: user } = await supabase.auth.admin.getUserById(userId);
              if (user?.user?.email) {
                await emailService.sendPaymentConfirmation(
                  user.user.email,
                  fullSession.amount_total || 0,
                  fullSession.currency || "usd"
                );
              }

              // Track one-time payment in PostHog
              posthog?.capture({
                distinctId: userId,
                event: "payment_one_time_succeeded",
                properties: {
                  amount: fullSession.amount_total || 0,
                  currency: fullSession.currency || "usd",
                  stripe_payment_intent_id: fullSession.payment_intent as string,
                  stripe_checkout_session_id: fullSession.id,
                },
              });
            } else {
              console.warn(
                `[Webhook] Unhandled checkout session mode: ${fullSession.mode} for event ${event.id}`
              );
            }
          }
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Get user_id from metadata
          const userId = paymentIntent.metadata?.user_id;
          if (!userId) {
            console.log(
              `[Webhook] Skipping payment_intent.succeeded - no user_id in metadata for payment intent ${paymentIntent.id}`
            );
            break;
          }

          console.log(
            `[Webhook] Processing payment_intent.succeeded for user ${userId}, payment intent ${paymentIntent.id}`
          );

          // Retrieve payment intent with expanded charges to get receipt URL
          let receiptUrl: string | null = null;
          try {
            const expandedPaymentIntent = await stripeService.retrievePaymentIntent(
              paymentIntent.id,
              ["charges"]
            );
            // Type assertion for expanded charges - Stripe expands charges as an array
            interface ExpandedPaymentIntent extends Stripe.PaymentIntent {
              charges?: Stripe.ApiList<Stripe.Charge>;
            }
            const expanded = expandedPaymentIntent as ExpandedPaymentIntent;
            if (expanded.charges?.data && expanded.charges.data.length > 0) {
              receiptUrl = expanded.charges.data[0]?.receipt_url || null;
            }
          } catch (error) {
            console.warn(
              `[Webhook] Could not retrieve expanded payment intent for receipt URL: ${error}`
            );
            // Continue without receipt URL
          }

          // Upsert payment history with idempotency
          const { error: paymentError } = await supabase
            .from("payment_history")
            .upsert(
              {
                user_id: userId,
                stripe_payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: "succeeded",
                receipt_url: receiptUrl,
              },
              { onConflict: "stripe_payment_intent_id" }
            );

          if (paymentError) {
            console.error(
              `[Webhook] Error upserting payment history for payment intent ${paymentIntent.id}:`,
              paymentError
            );
          } else {
            console.log(
              `[Webhook] Successfully recorded payment intent ${paymentIntent.id} for user ${userId}`
            );
          }

          // Track payment intent succeeded in PostHog
          posthog?.capture({
            distinctId: userId,
            event: "payment_intent_succeeded",
            properties: {
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              stripe_payment_intent_id: paymentIntent.id,
              receipt_url: receiptUrl,
            },
          });

          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;

          // Get user_id from metadata
          const userId = subscription.metadata?.user_id;
          if (!userId) {
            console.log("Skipping subscription.created - no user_id in metadata:", subscription.id);
            break;
          }

          // Check if subscription already exists (idempotency)
          const { data: existingSub } = await supabase
            .from("user_subscriptions")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (existingSub) {
            console.log("Subscription already exists:", subscription.id);
            break;
          }

          // Get the plan from price ID
          const priceId = subscription.items.data[0]?.price.id;
          const { data: plan } = await supabase
            .from("subscription_plans")
            .select("*")
        .or(
          `stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId},stripe_price_id_three_month.eq.${priceId}`
        )
            .single();

          // Create subscription record (but don't mark as active until payment completes)
          await supabase.from("user_subscriptions").insert({
            user_id: userId,
            stripe_customer_id: subscription.customer as string,
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

          // Track subscription creation in PostHog
          posthog?.capture({
            distinctId: userId,
            event: "subscription_created_webhook",
            properties: {
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              plan_name: plan?.name,
              plan_tier: plan?.tier,
            },
          });

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
            posthog?.capture({
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
            posthog?.identify({
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
            posthog?.capture({
              distinctId: subData.user_id,
              event: "subscription_cancelled",
              properties: {
                stripe_subscription_id: subscription.id,
                cancellation_reason: subscription.cancellation_details?.reason || "unknown",
              },
            });

            // Update user properties
            posthog?.identify({
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

        case "invoice.paid":
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as ExtendedInvoice;

          // Only process if this is a subscription invoice (has subscription field)
          if (!invoice.subscription) {
            console.log(`[Webhook] Skipping non-subscription invoice: ${invoice.id}`);
            break;
          }

          console.log(
            `[Webhook] Processing invoice payment succeeded for subscription ${invoice.subscription}, invoice ${invoice.id}`
          );

          // Get user from subscription
          const { data: subscription } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subscription?.user_id && invoice.payment_intent) {
            // Record recurring payment in payment_history with idempotency
            const { error: paymentError } = await supabase
              .from("payment_history")
              .upsert(
                {
                  user_id: subscription.user_id,
                  stripe_payment_intent_id: invoice.payment_intent,
                  amount: invoice.amount_paid ?? invoice.amount_due,
                  currency: invoice.currency,
                  status: "succeeded",
                  receipt_url: null, // Receipt URL not available from invoice
                },
                { onConflict: "stripe_payment_intent_id" }
              );

            if (paymentError) {
              console.error(
                `[Webhook] Error upserting recurring payment for payment intent ${invoice.payment_intent}:`,
                paymentError
              );
            } else {
              console.log(
                `[Webhook] Successfully recorded recurring payment for user ${subscription.user_id}, payment intent ${invoice.payment_intent}`
              );
            }

            // Send confirmation email
            const { data: user } = await supabase.auth.admin.getUserById(subscription.user_id);
            if (user?.user?.email) {
              await emailService.sendPaymentConfirmation(
                user.user.email,
                invoice.amount_paid ?? invoice.amount_due,
                invoice.currency
              );
            }

            // Track recurring payment in PostHog
            posthog?.capture({
              distinctId: subscription.user_id,
              event: "payment_recurring_succeeded",
              properties: {
                amount: invoice.amount_paid ?? invoice.amount_due,
                currency: invoice.currency,
                stripe_payment_intent_id: invoice.payment_intent,
                stripe_invoice_id: invoice.id,
                stripe_subscription_id: invoice.subscription,
              },
            });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as ExtendedInvoice;

          if (!invoice.subscription) {
            console.log(`[Webhook] Skipping non-subscription invoice: ${invoice.id}`);
            break;
          }

          console.log(
            `[Webhook] Processing invoice payment failed for subscription ${invoice.subscription}, invoice ${invoice.id}`
          );

          // Get user from subscription
          const { data: subscription } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subscription?.user_id && invoice.payment_intent) {
            // Record failed payment with idempotency
            const { error: paymentError } = await supabase
              .from("payment_history")
              .upsert(
                {
                  user_id: subscription.user_id,
                  stripe_payment_intent_id: invoice.payment_intent,
                  amount: invoice.amount_due,
                  currency: invoice.currency,
                  status: "failed",
                  receipt_url: null,
                },
                { onConflict: "stripe_payment_intent_id" }
              );

            if (paymentError) {
              console.error(
                `[Webhook] Error upserting failed payment for payment intent ${invoice.payment_intent}:`,
                paymentError
              );
            } else {
              console.log(
                `[Webhook] Successfully recorded failed payment for user ${subscription.user_id}, payment intent ${invoice.payment_intent}`
              );
            }

            // Send failure notification
            const { data: user } = await supabase.auth.admin.getUserById(subscription.user_id);
            if (user?.user?.email) {
              await emailService.sendPaymentFailed(user.user.email);
            }

            // Track payment failure in PostHog
            posthog?.capture({
              distinctId: subscription.user_id,
              event: "payment_failed",
              properties: {
                amount: invoice.amount_due,
                currency: invoice.currency,
                stripe_payment_intent_id: invoice.payment_intent,
                failure_reason: invoice.status_transitions?.finalized_at
                  ? "card_declined"
                  : "unknown",
              },
            });
          }
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type} (id: ${event.id})`);
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
