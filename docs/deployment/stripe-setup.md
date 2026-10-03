# PMLE Pass: Stripe setup

The only new offer is **PMLE Pass**: US **$39**, one payment for **90 days of full access** from payment. There is no subscription, auto-renewal, or trial. Customers can request a refund within **7 days**; any refund ends pass access. Active legacy subscriptions remain supported.

## Founder setup

1. In the Stripe dashboard, first use **test mode**. Create a product named **PMLE Pass** with one **one-time USD $39.00 price** (3900 cents). Do not create a recurring or three-month price. Archive retired offers for new purchases without canceling existing legacy subscriptions.
2. Copy the new `price_...` ID into the server environment variable **`STRIPE_PRICE_PMLE_PASS`**. The browser does not receive or choose a price ID. Test and live mode require separate price IDs and matching API keys.
3. In GitHub repository settings, create the Actions secret **`STRIPE_PRICE_PMLE_PASS`** with the price ID for the intended deployment. The deploy workflow passes it into the server runtime, not the Docker build. Existing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `PAYWALL_SIGNING_SECRET` must also be configured for that environment. Never put these secrets in browser variables or commit their values.
4. In Stripe dashboard webhook settings, add **`https://<app-host>/api/billing/webhook`**. Enable **`checkout.session.completed`** and **`charge.refunded`** for passes. Keep **`payment_intent.succeeded`**, **`customer.subscription.created`**, **`customer.subscription.updated`**, **`customer.subscription.deleted`**, **`invoice.paid`**, **`invoice.payment_succeeded`**, and **`invoice.payment_failed`** for payment records and existing legacy subscriptions. Configure that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` and its GitHub Actions secret. Separate test/live endpoints have separate signing secrets.
5. Review and apply **`supabase/migrations/20261003_create_pmle_passes.sql`** through the approved database migration process before enabling the offer. This change only writes the migration; it does not apply it.
6. Handle refund requests within the seven-day policy through the Stripe dashboard. Refunds automatically revoke access through `charge.refunded`; the app does not create a self-service refund portal for passes.

## Short test-mode QA checklist

- Anonymous checkout is refused. Sign in and check that checkout shows **PMLE Pass**, **$39 USD**, and **one-time** payment with no renewal.
- Use Stripe's test card `4242 4242 4242 4242`, a future expiry, and any test CVC. After paying, confirm full access and **Access until <date>**, 90 days after payment.
- Confirm a pass holder has no customer-portal button. An active legacy subscriber retains paid access and can manage the existing subscription.
- Replay the completed webhook from the Stripe dashboard. Confirm one pass row, the same expiry, and no duplicate extension. Do not infer payment success from visiting the success URL alone.
- Refund the test payment in Stripe. Confirm paid access ends, including with an old checkout confirmation cookie. Replay checkout completion and confirm it cannot restore the refunded pass.
- In a disposable test database, set a pass expiry in the past and confirm paid access ends. A free signed-in user keeps weekly quota practice and can view their own session summary without explanations.
- Anonymous diagnostic results show score, readiness tier, and unblurred domains, but no questions. Question review asks for an account; explanations and unlimited practice require paid access.
- Exhaust the free quota and confirm the dashboard shows the **PMLE Pass** upgrade path, not standalone practice. Direct question API/page access is refused for free/anonymous users. Diagnostic answer responses expose no correct answer or explanation.

These steps require founder-operated test services. No Stripe or Supabase service was called during the offline implementation checks.
