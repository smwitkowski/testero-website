# PMLE Pass: Stripe setup for Testero v2

The only new offer is **PMLE Pass**: **US $39 one-time**, **90 days** of full PMLE
access from payment, **no auto-renewal**, and a **7-day refund window**. Any refund,
including a partial refund, ends pass access. Active legacy subscriptions remain
supported, but v2 does not create new subscriptions, tiers, or trials.

## Founder setup

1. In the Stripe dashboard, start in **test mode**. Create a product named
   **PMLE Pass** and one **one-time USD $39.00 price** (3900 cents). Do not create
   a recurring or three-month price. Archive retired offers for new buyers without
   canceling existing legacy subscriptions.
2. Set server-only **`STRIPE_PRICE_PMLE_PASS`** to that `price_...` ID. Set
   **`STRIPE_SECRET_KEY`** to the matching test-mode key. The browser cannot select
   a price. Test and live mode have separate price IDs and API keys.
3. Add webhook endpoint **`https://<app-host>/api/billing/webhook`**. Enable:
   - **`checkout.session.completed`** — paid, payment-mode, configured-price pass.
   - **`charge.refunded`** — revoke access and save a durable refund tombstone.
   - **`customer.subscription.updated`**, **`customer.subscription.deleted`** —
     refresh existing legacy subscription status; no new subscription creation.
   Configure that endpoint's signing secret as **`STRIPE_WEBHOOK_SECRET`**.
   Checkout accepts cards, so no delayed-payment success event is required.
4. In GitHub Actions secrets, configure **`STRIPE_SECRET_KEY`**,
   **`STRIPE_WEBHOOK_SECRET`**, and **`STRIPE_PRICE_PMLE_PASS`**, plus the existing
   **`SUPABASE_SERVICE_ROLE_KEY`**, **`NEXT_PUBLIC_SUPABASE_URL`**,
   **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**, and Cloud Run/GCP secrets. Optional
   **`NEXT_PUBLIC_POSTHOG_KEY`** / **`NEXT_PUBLIC_POSTHOG_HOST`** enable analytics.
   Stripe and service-role secrets go to server runtime, never Docker build args
   or browser variables. v2 does **not** use `PAYWALL_SIGNING_SECRET`.
5. Review and apply **`supabase/migrations/20261003000000_v2_baseline.sql`** through
   the approved migration process. It already includes `pmle_passes`,
   `pmle_pass_refunds`, and order-safe fulfillment/refund functions. Local checks
   do not apply this baseline to a remote database.
6. Configure Stripe's customer portal for existing legacy subscriptions. Only
   active legacy subscribers see the portal. Pass buyers do not use it for refunds.
7. Handle refund requests within seven days through the Stripe dashboard.
   `charge.refunded` revokes access automatically. There is no self-service
   pass refund endpoint. A refund-before-checkout tombstone defeats later replay.
8. Repeat approved test-mode QA before switching to separate live-mode keys,
   price, endpoint, and signing secret. No push or deployment is part of this work.

## Local verification — no Stripe account or network needed

```sh
supabase start
supabase db reset --local  # disposable local DB only; deletes local data
npm run test:db:local
npm run test:e2e:local
```

`node scripts/local.mjs` obtains only this project's loopback Supabase keys and
injects deliberately fake Stripe values into child process environment. For dev
and browser tests it starts/reuses a **loopback-only HTTP fixture on port 56545**.
The real Stripe SDK uses that fixture, not Stripe. Raw webhook payloads are signed
locally with the runner's test-only webhook secret and verified by the SDK.
No credential files are read or written. PostHog stays disabled. Fixture mode is
refused in production and outside local Supabase port 56541. Never configure these
local placeholder values in production.

For manual local review, use `npm run dev:local` on port **3000**. Leave the frozen
Phase 1 preview on port **3100** untouched. The fake checkout success initially
shows processing; it does not grant access from a redirect alone.

## Founder-operated test-mode QA

- Signed-out pricing leads to signup with `next=/pricing`. Checkout refuses
  anonymous/unconfirmed users and ignores client prices.
- Checkout shows **PMLE Pass**, **$39 USD**, and a single payment. An existing
  paid account returns to `/account` rather than being charged again.
- Use Stripe test card `4242 4242 4242 4242`, future expiry, and any test CVC only
  in founder-operated test mode. Success says processing until the webhook grant
  exists. Then account shows **Access until <date>**, 90 × 24 hours from payment.
- Confirm explanations and unlimited five-question practice sessions. Free users
  retain five questions per week and explanation-free review. Anonymous diagnostic
  results remain aggregate-only. No correctness appears during a diagnostic.
- Replay completion: exactly one pass row, no expiry extension. Concurrent grant
  and refund, refund-first, and refund-after-grant all remain revoked on replay.
- Refund the test payment, then reload protected views. Explanations disappear and
  new practice uses the free quota again. A failed access read also denies paid
  features and blocks checkout, rather than risking a second charge.
- Legacy active accounts retain paid access and can open their owned customer
  portal. Pass-only, free, and inactive legacy accounts cannot open it.
- Inspect optional analytics: `checkout_started` client-side; `purchase_completed`
  server-side only after an unrefunded grant. No email, account ID, or raw customer
  identity is sent. Local tests mock or disable the analytics service.

Terms and Privacy remain unapproved Phase 4 placeholders. Founder legal approval
and production configuration are still required before launch.
