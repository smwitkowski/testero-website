## Week 4 Inputs: Auth, Billing, Analytics, CTAs

### A. How users + subscriptions are represented today

#### 1. Supabase auth + profile schema

- **auth.users (Supabase Auth)**:
  - Primary user record; key fields:
    - `id` (uuid): canonical user id used everywhere in app and Stripe metadata.
    - `email` (varchar), `email_confirmed_at`, `last_sign_in_at`.
    - `is_early_access` (bool, default false).
    - `raw_user_meta_data` (jsonb): used for feature flags like:
      - `has_subscription` (boolean; set from webhook/cron to mirror subscription state for UI shortcuts).
      - `has_used_trial` (boolean; set in `/api/billing/trial` to avoid duplicate trials).
  - There is **no separate `profiles` table** in the current codepath; all profile-ish data lives in `auth.users` metadata.

- **public.users (legacy)**:
  - Exists but not used by current Next.js app; legacy columns: `id`, `email`, `password_hash`, `name`, `created_at`.
  - All new work should treat `auth.users` as the source of truth.

- **public.user_subscriptions** (primary subscription table; inferred from code + migrations):
  - Columns (from `billing/status`, `trial`, `webhook`):
    - `user_id` (uuid FK → `auth.users.id`).
    - `stripe_customer_id` (text).
    - `stripe_subscription_id` (text).
    - `plan_id` (uuid FK → `subscription_plans.id`, nullable during trial).
    - `status` (text): `"trialing" | "active" | "past_due" | "canceled" | ...` (direct Stripe mirror).
    - `current_period_start`, `current_period_end` (timestamptz).
    - `trial_ends_at` (timestamptz, nullable; used for entitlement + status computation).
    - `cancel_at_period_end` (bool).
    - `created_at`, `updated_at`.
  - RLS is enabled so users only see their own rows; server-side auth queries bypass RLS.

- **public.subscription_plans**:
  - Lookup table for plan metadata, used in webhooks to enrich analytics:
    - `id` (uuid).
    - `name` (e.g., "Basic", "Pro", "All-Access").
    - `tier` (string used in analytics, e.g., `"basic"`, `"pro"`, `"all-access"`).
    - `price_monthly`, `price_yearly` (int, cents).
    - `stripe_price_id_monthly`, `stripe_price_id_yearly` (text).
    - `features` (jsonb).
  - Not exam-specific; plans are global across exams.

- **public.payment_history**:
  - Append-only record of individual Stripe payments (subscription & one-time):
    - `user_id` (uuid FK).
    - `stripe_payment_intent_id` (text, unique; used for idempotency).
    - `amount` (int, cents).
    - `currency` (text, e.g., `"usd"`).
    - `status` (`"succeeded" | "failed"`).
    - `receipt_url` (text, nullable).
    - `created_at` (timestamptz).

- **public.webhook_events**:
  - Idempotency + error logging for Stripe webhooks:
    - `stripe_event_id` (text, unique).
    - `type` (event type).
    - `processed` (bool).
    - `processed_at` (timestamptz, nullable).
    - `error` (text, nullable).

- **Other billing/legacy tables**:
  - `public.subscriptions`, `public.products`, `public.payments`: older schema; not used by current codepaths (replaced by `subscription_plans` + `user_subscriptions` + `payment_history`).
  - `public.practice_attempts`, `public.diagnostics_sessions`, `public.diagnostic_questions`, `public.diagnostic_responses` are used for readiness + practice tracking but **not** for entitlements.

#### 2. Current “who is logged in?” / “who is allowed?” logic

- **Client-side auth identity (`AuthProvider`)**:
  - Wraps app, calls `supabase.auth.getSession()` + `onAuthStateChange`.
  - Exposes `user`, `session`, `isLoading`, and `signOut` via `useAuth()`.
  - On login/restore, it calls `posthog.identify(user.id, { email, created_at, is_early_access, email_confirmed, provider })` and emits:
    - `user_session_started` (on login/restore).
    - `user_session_ended` (on logout).

- **Route protection (auth)**:
  - Comments + CLAUDE docs indicate **Next.js middleware** is the primary auth guard:
    - App pages like `/dashboard`, `/practice/question`, `/dashboard/billing` assume middleware has already redirected unauthenticated users to `/login?redirect=...`.
    - Anonymous access is explicitly allowed for `/diagnostic` (start page) and some content routes.

- **Subscription / entitlement model**:
  - Core entitlement check is `lib/billing/access.ts`:
    - `getBillingEnforcement()` reads `BILLING_ENFORCEMENT` env (`"off"` or `"active_required"`).
    - `isSubscriber(userId)` queries `user_subscriptions` for latest row and uses `computeSubscriptionEntitlement(status, cancel_at_period_end, current_period_end)`:
      - `status in ("active", "trialing")` → eligible, with additional `cancel_at_period_end && now < current_period_end` check.
      - All other statuses → not entitled.
    - Results are cached per-user (LRU up to 1,000 users; TTL 60s for `true`, 30s for `false`).
  - When `BILLING_ENFORCEMENT="off"`:
    - All premium checks effectively no-op (everyone is treated as allowed).
  - When `BILLING_ENFORCEMENT="active_required"`:
    - Entitlements are required for both SSR pages and API routes (see below).

- **Server-side page gating**:
  - Premium pages use a gating helper (via `lib/billing/access.ts` and a `createGatedLayout` factory described in the changelog):
    - Pages like diagnostic and practice are *intended* to be gated when enforcement is `"active_required"`.
    - If user is not a subscriber, they are redirected to `/pricing?gated=1&feature=diagnostic|practice`.
    - `study-path` is explicitly **left ungated** by design (free feature).

- **API-level gating**:
  - `lib/auth/require-subscriber.ts` guards premium API routes; it:
    - Short-circuits if `isBillingEnforcementActive()` is false.
    - Allows access if a valid **grace cookie** is present (see billing below).
    - Otherwise:
      - Uses `createServerSupabaseClient().auth.getUser()` to authenticate.
      - Uses `isSubscriber(user.id)` (from `lib/auth/entitlements.ts`, which queries `user_subscriptions` with its own small LRU cache).
      - Emits `ENTITLEMENT_CHECK_FAILED` PostHog event and logs a structured `paywall_block` when blocking.
      - Returns `403` JSON `{ code: "PAYWALL" }` on failure.
  - Gated endpoints (per changelog) include:
    - `/api/diagnostic` (GET/POST; main diagnostic flow).
    - `/api/diagnostic/session` and `/api/diagnostic/session/[id]/status`.
    - `/api/diagnostic/summary/[sessionId]`.
    - `/api/questions`, `/api/questions/[id]`, `/api/questions/current`, `/api/questions/submit`.
    - The new `/api/practice/session` endpoint fits the same pattern (premium practice).

- **Soft “plan” / subscription flags on the user**:
  - `auth.users.raw_user_meta_data` is used as a soft mirror for UI:
    - `has_subscription` (boolean) is read on diagnostic summary and dashboard to decide whether to show the trial upsell.
    - `has_used_trial` (boolean) is read by `/api/billing/trial` to avoid duplicate trials; trial endpoint also cross-checks `user_subscriptions` history to resolve inconsistencies.
  - **Authoritative gating is always based on `user_subscriptions`**, not the metadata flags.

---

### B. Stripe setup and integration

#### 3. What exists in Stripe right now

- **Subscription products (test mode)** — from Stripe MCP + `docs/deployment/stripe-price-ids.md`:
  - **Basic** (`prod_TKP1Qa6MF9RIX9`):
    - Monthly: `price_1SNkDtRqq8mPUhEry3BHJl1K` — **$14.99/month** (needs new price created in Stripe).
    - 3-Month: **$39.99 every 3 months** (needs new price created in Stripe with `interval=month`, `interval_count=3`).
    - ~~Annual: `price_1SNkDvRqq8mPUhErb1atjbrv` — **$349/year**~~ (archived, grandfathered for existing subscribers).
  - **Pro** (`prod_TKP2zVCiYtDZcY`):
    - Monthly: `price_1SNkE1Rqq8mPUhErlkNKsMpA` — **$59/month**.
    - 3-Month: (needs new price created in Stripe with `interval=month`, `interval_count=3`).
    - ~~Annual: `price_1SNkE2Rqq8mPUhEr22dHvDgC` — **$549/year**~~ (archived, grandfathered for existing subscribers).
  - **All-Access** (`prod_TKP2Bog4uwEo6H`):
    - Monthly: `price_1SNkE6Rqq8mPUhErJyWYqzQM` — **$79/month**.
    - 3-Month: (needs new price created in Stripe with `interval=month`, `interval_count=3`).
    - ~~Annual: `price_1SNkE7Rqq8mPUhErRL63Fu3d` — **$749/year**~~ (archived, grandfathered for existing subscribers).

- **One-time PMLE exam packages (test mode)**:
  - **3-Month Access** (`prod_TKP2DL9Cnf3ftm`):
    - Price: `price_1SNkEERqq8mPUhEr72jPCaPa` — **$99 one-time**.
  - **6-Month Access** (`prod_TKP2ZUMDlikQXn`):
    - Price: `price_1SNkEFRqq8mPUhErJED2VPKt` — **$149 one-time**.
  - **12-Month Access** (`prod_TKP2geidSx6xaf`):
    - Price: `price_1SNkEFRqq8mPUhErivTNpT1I` — **$199 one-time**.

- **Environment variables** wired into the app (`lib/pricing/constants.ts`):
  - `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY/3MONTH` → Basic plan price IDs ($14.99/month, $39.99/3 months).
  - `NEXT_PUBLIC_STRIPE_PRO_MONTHLY/3MONTH` → Pro plan price IDs (hidden tiers).
  - `NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY/3MONTH` → All-Access plan price IDs (hidden tiers).
  - `NEXT_PUBLIC_STRIPE_EXAM_3MONTH/6MONTH/12MONTH` → single-exam package price IDs.

#### 4. Stripe integration code and data flow

- **Stripe service wrapper** (`lib/stripe/stripe-service.ts`):
  - Initializes `Stripe` with `STRIPE_SECRET_KEY` + `STRIPE_API_VERSION`.
  - Key methods:
    - `createOrRetrieveCustomer(userId, email)`: search by `metadata["supabase_user_id"]` and create if missing.
    - `getPriceType(priceId)`: detect `"subscription"` vs `"payment"` from Stripe price.
    - `createCheckoutSession({ customerId, priceId, successUrl, cancelUrl, userId, mode? })`:
      - Sets `mode` to `"subscription"` for recurring prices, `"payment"` for one-time.
      - Attaches `{ user_id: <supabase user id> }` in both session and `subscription_data.metadata`.
    - `createPortalSession(customerId, returnUrl)`: Stripe Billing Portal.
    - `retrieveSubscription`, `cancelSubscription`, `retrieveCheckoutSession`, `retrievePaymentIntent`, `listCustomerSubscriptions`.
    - `createTrialSubscription({ customerId, priceId, trialDays, userId })`: direct 14-day trial subscription (no Checkout UI).
    - `convertTrialToPaid(subscriptionId, paymentMethodId)`.

- **Checkout flow** (`POST /api/billing/checkout`):
  - Rate-limited via shared `checkRateLimit`.
  - Requires authenticated user via `createServerSupabaseClient().auth.getUser()`.
  - Validates `priceId` against known IDs from `SUBSCRIPTION_TIERS` and `EXAM_PACKAGES`.
  - For subscription prices:
    - Checks `user_subscriptions` for an existing `status="active"` row and blocks with `400` if present.
  - Uses `StripeService.createOrRetrieveCustomer` + `createCheckoutSession`.
  - Success URL: `/api/billing/checkout/success?session_id={CHECKOUT_SESSION_ID}`.
  - Cancel URL: `/pricing`.
  - Returns `{ url }` to client; `/pricing` page redirects browser to Stripe Checkout.

- **Checkout success + grace cookie** (`GET /api/billing/checkout/success`):
  - Verifies:
    - `session_id` query parameter present.
    - Authenticated Supabase user.
    - Stripe checkout session exists and `payment_status === "paid"`.
    - `session.metadata.user_id` matches current Supabase user id.
  - On success:
    - Issues a short-lived **billing grace cookie** via `signGraceCookie()` (`PAYWALL_SIGNING_SECRET`).
    - Redirects to `/dashboard/billing?success=1`.
  - If any check fails: redirect to `/dashboard/billing?success=0`.

- **Webhook processing** (`POST /api/billing/webhook`):
  - Verifies `stripe-signature` using `STRIPE_WEBHOOK_SECRET`.
  - Tracks idempotency via `webhook_events` table.
  - Handles:
    - `checkout.session.completed`:
      - Uses `session.metadata.user_id` to look up Supabase user.
      - For `session.mode === "subscription"`:
        - Fetches full Subscription via Stripe API.
        - Joins `subscription_plans` by `price.id` to set `plan_id`.
        - Upserts into `user_subscriptions` with:
          - `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `stripe_customer_id`, `stripe_subscription_id`.
      - For `session.mode === "payment"`:
        - Upserts one-time payment row in `payment_history`.
      - Sends confirmation email via `EmailService` (Resend).
      - Emits `subscription_created` or `payment_one_time_succeeded` PostHog events with rich properties.
    - `payment_intent.succeeded`:
      - Ensures `payment_history` has a row (idempotent upsert) and attaches `receipt_url` when available.
      - Emits `payment_intent_succeeded`.
    - `customer.subscription.created/updated/deleted`:
      - Keeps `user_subscriptions` in sync (`status`, period dates, cancel flags).
      - Emits `subscription_created_webhook`, `subscription_updated`, `subscription_cancelled`.
      - Updates PostHog user properties (`subscription_status`, `is_paying_customer`, `churned_at`, etc.).
    - `invoice.paid` / `invoice.payment_succeeded`:
      - Records recurring subscription charges into `payment_history`.
      - Emits `payment_recurring_succeeded`.
    - `invoice.payment_failed`:
      - Records failed payments into `payment_history`.
      - Emits `payment_failed` and sends failure email.

- **Billing/trial endpoint** (`POST /api/billing/trial`):
  - Authenticated-only; rate-limited.
  - Enforces **one trial per user**:
    - Checks `user_subscriptions` for any `status IN ('active','trialing')`.
    - Scans historical rows to see if trial was actually used (`trial_ends_at` non-null and status not `trialing`).
    - Also uses `user.user_metadata.has_used_trial` as a secondary indicator, but corrects metadata if it's inconsistent with DB.
  - Creates/gets Stripe customer; chooses default price ID:
    - `priceId` param from body if provided **or** `NEXT_PUBLIC_STRIPE_PRO_MONTHLY` fallback.
  - Calls `StripeService.createTrialSubscription` with 14-day `trial_period_days`.
  - Inserts a `user_subscriptions` row locally with `status='trialing'`, `trial_ends_at`, `current_period_end`.
  - Sets `auth.users.raw_user_meta_data.has_used_trial = true`.
  - Emits `trial_started` PostHog event with:
    - `trial_days`, `price_id`, `tier_name` (derived via `getTierNameFromPriceId`), and anonymous-session linkage if applicable.

- **Billing portal** (`POST /api/billing/portal` + `/dashboard/billing` page):
  - `/dashboard/billing` reads:
    - `user_subscriptions` + `subscription_plans` to show current plan, status, period, and pricing.
    - `payment_history` (last 10 rows).
  - “Manage subscription” button:
    - Calls `/api/billing/portal`, which:
      - Authenticates user.
      - Gets `stripe_customer_id` from `user_subscriptions`.
      - Creates a Stripe Billing Portal session with return URL `/dashboard/billing`.
      - Emits `billing_portal_accessed` PostHog event.

- **Billing status for UI** (`GET /api/billing/status`):
  - Lightweight endpoint for front-end gating:
    - If unauthenticated: `{ isSubscriber: false, status: "none" }`.
    - Else: queries `user_subscriptions` for `"active" | "trialing"` first; falls back to “latest any status” for UI (e.g., “canceled”).
  - Uses shared `computeIsSubscriber` helper (trial still in future → subscriber).
  - Always returns `200` and never exposes Stripe IDs.

---

### C. Current Loops (email) setup

#### 5. Existing Loops flows + fields

- **Waitlist → Loops contact creation** (`POST /api/waitlist`):
  - Validates `{ email, examType? }` with zod.
  - Inserts into `public.waitlist` with fields:
    - `email` (text, unique).
    - `exam_type` (text).
  - If `LOOPS_API_KEY` is set:
    - POSTs to `https://app.loops.so/api/v1/contacts/create` with JSON body:
      - `email`: user email.
      - `examType`: optional (passed through when present).
      - `userGroup: "Waitlist"`.
    - Logs, but does **not** fail the whole request if Loops errors.
- **Loops data model in code** (`lib/analytics/campaign-metrics.ts`):
  - Defines `LoopsData` and helpers to combine Loops email metrics with PostHog events:
    - `aggregateCampaignData(loopsData, posthogEvents, campaignId?)` produces campaign funnels (emails sent → diagnostic completed).
  - This is currently a **pure utility**; there is no wired-in job that actually pulls Loops stats into the app.

- **Historical Loops welcome sequence (waitlist)**:
  - You previously had a **3-email welcome/onboarding sequence** for people who joined the waitlist (orientation, value prop, and nudge toward diagnostic/practice).
  - Today:
    - There is still a **“waitlist welcome”** email configured in Loops, but it is **not currently attached** to new signups.
    - New waitlist signups *do* become Loops contacts via `/api/waitlist`, but **no sequence runs** until you reattach that flow in Loops.

- **Inferred Loops flows**:
  - From code alone, the only guaranteed Loops flow is:
    - Waitlist signups → Loops contacts with `userGroup="Waitlist"` and optional `examType`.
  - Any welcome/onboarding sequences, automations, refund emails, etc. live entirely inside Loops and are not visible in this repo.

#### 6. How Loops is triggered today

- **Triggers**:
  - **Waitlist form**: user submits main waitlist form → `/api/waitlist` → Supabase insert + Loops contact create.
- **Non-triggers**:
  - Diagnostic start/completion, trial start, checkout completion, and cancellation do **not** currently talk directly to Loops; they are instrumented only via PostHog and internal email service (Resend).
- **Email analytics bridge**:
  - PostHog events like `email_campaign_landing` and `campaign_attribution_set` are used to reconstruct campaign funnels in analytics (see `docs/posthog-events-data-dictionary.md` and `lib/analytics/campaign-metrics.ts`), but they do not call Loops themselves.

---

### D. Current landing/pricing UX and upgrade touchpoints

#### 7. Landing page + pricing UX

- **Main landing page** (`app/page.tsx`):
  - Hero section:
    - Primary CTA: **“Try Free Diagnostic”** → `/diagnostic`.
    - Secondary CTA: **“View Pricing Plans”** → `/pricing` (also fires `PRICING_PAGE_VIEWED` with `source="homepage_hero_secondary"` via `trackEvent`).
  - Multiple pricing-related links:
    - Pricing preview section (“Choose Your PMLE Success Plan”) with cards for Basic / Pro / All-Access using `SUBSCRIPTION_TIERS` for copy but **not** for direct checkout; cards link to `/pricing`.
    - Final CTA section with **“See Pricing & Start Today”** (→ `/pricing`) and **“Take Free Diagnostic First”** (→ `/diagnostic`).
    - Footer “View All Pricing Options” link → `/pricing`.
  - Messaging:
    - Heavy focus on PMLE: “Pass PMLE in 30 Days — Or Your Money Back”.
    - Teases **“Free diagnostic test • 7-day money-back guarantee • Cancel anytime”**.

- **Pricing page** (`app/pricing/page.tsx`):
  - Hero: broad SaaS pricing, not PMLE-only:
    - Plans: Basic, Pro, All-Access with feature comparisons and AI credit framing.
    - Billing interval toggle (monthly vs annual) with `pricing_plan_selected` events.
  - **Primary CTAs**:
    - Each subscription card uses `<PricingCard>` which calls `handleCheckout(priceId, planName)`:
      - Unauthenticated: redirects to `/signup?redirect=/pricing` and fires `SIGNUP_ATTEMPT` with `source="pricing_checkout_redirect"`.
      - Authenticated: `POST /api/billing/checkout` and, on success, navigates to Stripe Checkout.
    - “Exam packages” section surfaces one-time exam products; each has a **“Get Started”** button that calls `handleCheckout(pkg.priceId, pkg.duration)` using the same flow.
  - **Final CTA**:
    - At bottom: **“Start Free Diagnostic”** button → `/signup` (note: label says “Start Free Diagnostic” but route is signup; diagnostic is a post-signup action).

#### 8. In-app upgrade touchpoints

- **Dashboard** (`/dashboard`):
  - For users coming through beta flow, a beta banner is conditionally shown based on feature flags (`FEATURE_FLAGS.BETA_ONBOARDING_FLOW` and URL params):
    - CTA: **“Take a 10-min diagnostic”** (via `handleStartDiagnostic` → `POST /api/diagnostic/session`).
  - The **ReadinessMeter** card:
    - For users without a completed PMLE diagnostic, shows a “Get Your Readiness Baseline” empty state with **“Start Diagnostic”** CTA.
  - No dedicated “Upgrade” button on dashboard itself; upgrade flows are primarily via pricing and gating.

- **Diagnostic summary page** (`/diagnostic/[sessionId]/summary`):
  - Key CTAs:
    - Top-level: **“Start 10-min practice on your weakest topics”** → creates `/api/practice/session` with weakest PMLE domains.
    - Secondary: **“Retake diagnostic (20 Q)”** → `/diagnostic`.
  - Trial & upsell:
    - Shows **TrialConversionModal** after a delay for users without `has_subscription`, emitting `trial_modal_shown` and `trial_cta_clicked` events.
    - Uses `UpsellModal` + `UpgradePrompt`-style analytics to test different upsell variants and triggers (exit-intent, deep scroll, etc.).
  - These CTAs currently do **not** explicitly mention pricing; they are more “next step in readiness loop” oriented.

- **Practice question page** (`/practice/question`) and other gated features:
  - When billing enforcement is `"active_required"` and user is not entitled, premium-gated components are expected to mount `UpgradePrompt`:
    - Modal copies: “Unlock premium features”. Buttons: **“Choose a plan”** (→ `/pricing`) and “Dismiss”.
    - Emits `gate_viewed` / `upsell_view`, `gate_cta_clicked`, `gate_dismissed` / `upsell_dismiss` events with `route` and `feature` context.
  - SSR + API gating ensure that even if the modal is bypassed, unauthorized access is blocked with `403 { code: "PAYWALL" }`.

- **Billing dashboard** (`/dashboard/billing`):
  - For users **without** a subscription:
    - Shows “You don’t have an active subscription” with **“View Plans”** (→ `/pricing`).
  - For subscribers:
    - Shows “Manage Subscription” button → `/api/billing/portal` → Stripe Billing Portal.

---

### E. Rough funnel / usage data (directional)

#### 9. Current behavior snapshots (instrumentation vs numbers)

- **Instrumentation is rich; tools can’t compute everything, but you’ve provided directional numbers**:
  - PostHog MCP in this workspace exposes event definitions but not an easy, supported way to run a Trends query with the current `query-run` contract (it expects an `InsightVizNode`/`DataVisualizationNode` wrapper).
  - From your description:
    - **Visitors / active users**: roughly **40 per week** on average (with some recent spikes).
    - **Signups**: essentially **near-zero** to date (roughly one signup total so far).
    - As a result, practical conversion from signup → diagnostic → paid is effectively **0%** right now; Week 4 is about turning this into a testable loop.

- **Relevant events already in production (from `docs/posthog-events-data-dictionary.md` + MCP)**:
  - Signup funnel: `signup_page_viewed`, `signup_form_interaction_start`, `signup_attempt`, `signup_success`, `signup_error`, `signup_rate_limited`, plus guest upgrade events.
  - Diagnostic funnel: `diagnostic_started`, `diagnostic_question_answered`, `diagnostic_completed`, `diagnostic_summary_viewed`, `diagnostic_resume_shown`, `diagnostic_session_created` (beta flow).
  - Pricing & checkout: `pricing_page_viewed`, `pricing_plan_selected`, `checkout_initiated`, `checkout_session_created`, `checkout_error`.
  - Trial & conversion: `trial_started`, `trial_modal_shown`, `trial_cta_clicked`, `trial_to_paid_conversion`.
- **How to get the ballpark numbers in PostHog UI** (recommended baseline before Week 4):
  - Build a **Trends** insight per event, last 30 days, filtered to production project:
    - `signup_success` (daily count).
    - `diagnostic_started` and `diagnostic_completed` (two series; completion % = completed/started).
    - `checkout_initiated` vs `subscription_created` (conversion from pricing to paid).
  - Optionally, build a **funnel**:
    - Steps: `signup_success` → `diagnostic_started` → `diagnostic_completed` → `checkout_initiated` → `subscription_created`.

---

### F. Nice-to-have inputs

#### 10. Existing intuition on free vs paid (from current code + copy)

- **What’s clearly free today (by design)**:
  - **Diagnostic start**:
    - Homepage CTA “Try Free Diagnostic” links directly to `/diagnostic` with no login required.
    - Diagnostic start page explicitly says “No signup required! Take the diagnostic anonymously...” and supports anonymous sessions via `anonymous_session_id`.
  - **At least some practice**:
    - `PRICING_FAQ` includes: “We offer a free diagnostic test and limited practice questions. This lets you experience our platform before committing to a paid plan.”
  - **Study path page**:
    - Changelog calls out that `/api/study-path` and associated UI remain **public/ungated**, even when billing enforcement is on.

- **What’s clearly paid / premium in the current architecture**:
  - When `BILLING_ENFORCEMENT="active_required"`, the following are treated as **subscriber features**:
    - Diagnostic API (`/api/diagnostic*`) and pages.
    - Practice API (`/api/questions*`, `/api/practice/session`) and practice pages.
  - Premium experiences surfaced in marketing & pricing:
    - Unlimited PMLE practice questions, AI explanations, and advanced analytics.
    - Readiness dashboard with domain-level breakdown and study plans.
    - Multi-track access (Pro and All-Access).
    - Trial access (14 days) and subscription entitlements.

- **Implied free vs paid boundary from copy + code**:
  - Free:
    - At least one PMLE diagnostic (probably 10–20 questions) without signup.
    - Some small amount of practice (“limited questions”) before requiring a plan or trial.
  - Paid (or trial):
    - Ongoing diagnostic access (repeat diagnostics, canonical PMLE blueprint).
    - Domain-targeted practice loops from diagnostic summary (`/api/practice/session`).
    - Retained readiness history + dashboard metrics.
    - Multi-exam track access (beyond PMLE) as the product broadens.

- **Founder’s explicit Week 4 free vs paid spec for PMLE (clarified)**:
  - **Per-exam free diagnostic**:
    - Users can take **one free diagnostic per exam**; for Week 4 we care primarily about **one free PMLE diagnostic**.
  - **Results visibility**:
    - Anonymous users **cannot view full diagnostic results**; they must **sign up** (free account) to unlock the summary.
    - Once signed up (free tier), they can see their diagnostic summary, but explanations remain a paid feature.
  - **Free, signed-in tier (not paying)**:
    - Can:
      - View PMLE diagnostic summary after signup.
      - Access a **very limited amount of practice** from a constrained subset of questions (e.g., around **5 questions per week**).
    - Cannot:
      - Access explanations (those are reserved for paying users).
      - Run unlimited or fully domain-targeted practice loops; they’re capped to a small, curated slice of the bank.
  - **Paid PMLE tier**:
    - Gets:
      - Ongoing diagnostic access and summary access.
      - Substantially more practice volume and domain coverage (still a curated subset, not necessarily every internal question).
      - **Explanations** for diagnostic questions in the results view.
    - For practice:
      - Explanations are still **paid-only**, but you may choose to show them only in diagnostic results (not necessarily on every practice question) to keep the diagnostic as the primary learning artifact.
  - **Global rule on explanations**:
    - **Explanations are paid**:
      - Free / anonymous users do **not** see explanations.
      - Paying users see them at least in PMLE diagnostic summary; practice-explanation UX can be layered in later.

#### 11. Monetization-related PostHog events (current schema)

- **Subscription & billing events** (from data dictionary):
  - Webhook-driven:
    - `subscription_created`, `subscription_created_webhook`, `subscription_updated`, `subscription_cancelled`.
    - `payment_intent_succeeded`, `payment_one_time_succeeded`, `payment_recurring_succeeded`, `payment_failed`.
  - Checkout + billing UX:
    - `checkout_initiated`, `checkout_session_created`, `checkout_error`.
    - `billing_portal_accessed`, `billing_portal_requested`.
  - Paywall / gating:
    - `gate_viewed` / `upsell_view`, `gate_cta_clicked`, `gate_dismissed` / `upsell_dismiss`.
    - `entitlement_check_failed` (records route, required tier, and context).
- **Pricing & conversion events**:
  - `pricing_page_viewed`, `pricing_plan_selected`.
  - Trial-specific conversion events:
    - `trial_started`, `trial_to_paid_conversion`, `trial_modal_shown`, `trial_cta_clicked`.
- **Campaign + acquisition**:
  - `email_campaign_landing`, `campaign_attribution_set`, `email_campaign_tracking_pixel_loaded`.
  - Waitlist: `waitlist_page_viewed`, `waitlist_joined`, `waitlist_form_submission_error`, `waitlist_form_interaction_start`.

#### 12. Legal / operational constraints around billing (as implemented today)

- **Refunds & guarantees** (from pricing copy and docs):
  - `PRICING_FAQ` explicitly states:
    - **7-day money-back guarantee** — “If you're not satisfied, contact us within 7 days for a full refund, no questions asked.”
    - **Pass guarantee** — “If you complete 80% of your personalized study plan and don't pass your exam, we'll give you 3 additional months free to prepare for your retake.”
  - These guarantees are implemented as **policy + support flows**, not automated logic in the codebase (refunds are still manual via Stripe dashboard or future tooling).
  - From your clarification:
    - You **do not currently operate any formal refund/retake machinery**; guarantees live primarily in marketing copy, not in day-to-day operations.
    - Week 4 design should treat refunds/retakes as **manual, exceptional support decisions**, not a core part of the monetization loop.

- **Trials**:
  - Free trial is **14 days** by default (`trialDays=14` in `/api/billing/trial`).
  - Enforced **one trial per user** with:
    - DB history check on `user_subscriptions`.
    - Metadata flag `has_used_trial` (with logic to repair inconsistent states).
  - If a user previously had a trial subscription that never actually existed in DB (metadata-only), the trial endpoint explicitly clears bad metadata and allows a real trial.
  - **Week 4 intention**:
    - You want a **simple “free vs paid” model with no Pro trials** for PMLE:
      - No 7‑ or 14‑day paid trials; users either stay on the free tier or upgrade straight to paid.
    - Practically, Week 4 spec should:
      - **Hide or remove trial CTAs** (e.g., trial modals on diagnostic summary) from the PMLE experience.
      - Treat the existing `/api/billing/trial` endpoint and associated PostHog events (`trial_started`, `trial_modal_shown`, etc.) as **legacy/optional infrastructure**, not part of the main PMLE monetization loop.

- **Cancellation & pausing**:
  - Stripe side:
    - `cancel_at_period_end` is used to schedule cancellations; entitlement computation respects `current_period_end`.
    - Billing portal is the primary UI for users to cancel or change payment methods.
  - Copy in `PRICING_FAQ` and UI:
    - “Cancel anytime” messaging throughout landing/pricing.
    - FAQ mentions ability to “pause” subscription for up to 3 months; actual pause behavior would be implemented via Stripe (e.g., cancel + coupon or schedule) but is not yet codified in app logic.

- **Geography & pricing**:
  - All configured prices are in **USD**; there is no geo-specific pricing logic in the code.
  - The app assumes a single currency and does not enforce geographic restrictions at the application layer.

- **Security & rate limits**:
  - All billing endpoints (`/api/billing/*`) are:
    - Rate-limited (3 requests/minute per IP) using Upstash Redis.
    - Authenticated (must have a valid Supabase session).
  - Webhooks:
    - All webhook events are verified with `stripe-signature`.
    - Idempotency via `webhook_events`.
  - Entitlements:
    - Critical paywalled APIs rely on server-side checks only (no trust in client flags).

---

### G. PMLE-specific acquisition → activation → monetization loop (current state)

- **Acquisition**:
  - Primary entry: marketing homepage (`/`) with strong PMLE positioning and CTAs to `/diagnostic` (free) and `/pricing`.
  - Secondary: waitlist (`/waitlist`) and beta flow (`/beta`, `/beta/welcome`) with diagnostic-focused CTAs and Loops-powered email capture on waitlist.

- **Activation**:
  - Anonymous or logged-in users start a PMLE diagnostic (`/diagnostic` → `/api/diagnostic`).
  - Completion leads to a rich diagnostic summary that:
    - Computes readiness, domain breakdown, and a 3-phase study plan.
    - Offers **“Start 10-min practice on your weakest topics”** (→ `/api/practice/session`) and **“Retake diagnostic”**.
    - Shows trial & upsell modals for unsubscribed users with PostHog instrumentation.

- **Monetization**:
  - Primary upgrade paths today:
    - Pricing page CTAs → Stripe subscription or one-time exam packages.
    - Billing dashboard for existing subscribers → Stripe customer portal.
    - Premium gates (`UpgradePrompt`) when `BILLING_ENFORCEMENT="active_required"` on diagnostic/practice or other premium endpoints.
    - Trial conversion modals on diagnostic summary (planned to be **removed or repurposed** for PMLE as you move to a no-trial model).
  - All critical monetization events (trial started, checkout initiated, subscription created, payments succeeded/failed) are tracked in PostHog and tied back to `auth.users.id` and Stripe IDs, giving a solid basis for Week 4 experiments around a PMLE-specific free vs paid loop even as trials are phased out.


