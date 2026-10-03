# Stripe payment integration

## PMLE Pass

**PMLE Pass** costs **US $39** for **90 days of full access** from payment. It is a one-time purchase with no renewal or trial. Refund requests are accepted within seven days; a refund revokes pass access.

- Checkout requires a signed-in user. The server uses `STRIPE_PRICE_PMLE_PASS` with Stripe Checkout `mode: "payment"`; no client-selected price is trusted.
- `lib/stripe/pmle-pass.ts` validates the configured price, completed payment, user metadata, and current refund state. `checkout.session.completed` and verified checkout success use shared idempotent fulfillment, so a delayed webhook does not leave a successful purchaser without access.
- `public.pmle_passes` stores the user, unique checkout session and payment intent, Stripe customer, `paid_at`, `expires_at`, and nullable `refunded_at`. Expiry is exactly payment time plus 90 days, not a recurring billing interval.
- `webhook_events` deduplicates delivery. The unique checkout session prevents duplicate passes or expiry extension. Retrying fulfillment must never clear `refunded_at`.
- `charge.refunded` revokes the matching pass. A small `pmle_pass_refunds` tombstone table and the service-role-only `fulfill_pmle_pass` / `refund_pmle_pass` functions serialize writes for each payment intent. A refund arriving before the pass is recorded cannot be lost, even if a later Stripe read fails. Webhook and verified fulfillment writes use the server-only service-role Supabase client.
- `lib/billing/paid-access.ts` is the single access rule: an active legacy subscription **or** an unexpired, unrefunded pass. No trial or environment flag grants paid access. Per-user caching cannot delay refunds.
- The entitlement matrix gates unlimited practice and explanations. Free accounts retain quota practice and their own summaries without explanations. Anonymous diagnostic summaries contain score/readiness/domains but no questions.
- Checkout confirmation cookies are signed, bound to the purchaser and session, and expire after 15 minutes. They are not an authorization bypass.
- The billing page displays the pass expiry. Only users with existing legacy subscription records can open the Stripe customer portal. Legacy subscription webhook support remains in place.

## Deployment

Review `supabase/migrations/20261003_create_pmle_passes.sql` and apply it through the approved migration process. RLS permits users to read their own passes and reserves writes for the service role. No migration is applied by the code-writing task.

See [PMLE Pass: Stripe setup](./stripe-setup.md) for the exact founder setup and Stripe test-mode QA checklist. See [Stripe price configuration](./stripe-price-ids.md) for the server-only price variable.

## Validation limits

The implementation checks use mocked services and static SQL contract tests; they do not apply the migration or prove production Stripe delivery. Pass grant/refund writes are serialized. The existing `payment_history` handlers do not share that lock: overlapping payment-success and refund writes can leave a stale receipt status, even though the pass stays revoked. This history-only race does not grant access.
