# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Billing status API endpoint (`GET /api/billing/status`) returning lightweight subscription status for UI decisions only. Server remains authoritative for authorization. No sensitive plan details (plan_id, Stripe IDs, amounts) are returned.
- `useSubscriptionStatus` hook for client-side subscription status with optional SSR-provided initial value, automatic refetch on auth changes, and manual refetch capability.
- Shared subscription status computation helper (`lib/billing/subscription-status.ts`) reused by API and server-side authorization checks.
- **SSR Page Gating for Premium Pages**: Added server-side gating for diagnostic and practice pages using Next.js layouts. When `BILLING_ENFORCEMENT="active_required"` environment variable is set, free users are redirected to `/pricing?gated=1&feature=diagnostic|practice`. Subscribers (active or trialing with valid trial_ends_at) see normal content. Implemented via `lib/billing/is-subscriber.ts` helper querying Supabase `user_subscriptions` table, `lib/billing/enforcement.ts` for environment variable checking, and reusable `createGatedLayout` factory function in `lib/billing/gated-layout.ts` (P1.3)
- **Premium API Gating**: Added authoritative backend gating for premium API routes using `requireSubscriber` middleware. Non-subscribers receive 403 JSON response with `{ code: 'PAYWALL' }`. Subscribers and valid grace-cookie users pass. Gated routes include: `/api/diagnostic` (GET, POST), `/api/diagnostic/session` (POST), `/api/diagnostic/session/[id]/status` (GET), `/api/diagnostic/summary/[sessionId]` (GET), `/api/questions` (GET), `/api/questions/[id]` (GET), `/api/questions/current` (GET), `/api/questions/submit` (POST). Note: `/api/study-path` remains public per design.
- **Grace Cookie Support**: Added HMAC-signed grace cookie (`tgrace`) with payload `{ userId, exp }` signed using `GRACE_COOKIE_SECRET`. Valid grace cookies bypass authentication and subscription checks, allowing temporary premium access for 24 hours. Grace cookie validation uses SHA-256 HMAC signatures for security.
- **Entitlement Checking**: Created `lib/auth/entitlements.ts` with LRU cache (size 500, TTL 60s) to reduce duplicate subscription status reads. `isSubscriber()` function queries `user_subscriptions` table for `status IN ('active','trialing')` with caching.
- **Premium Gating Analytics**: Added `ENTITLEMENT_CHECK_FAILED` analytics event captured via PostHog when paywall blocks occur. Structured logs emit `paywall_block` events with route, userId, reason, and timestamp for observability.
- **Premium Gating Tests**: Added comprehensive unit tests for `requireSubscriber` covering grace cookie validation, authentication checks, subscription checks, and structured logging. Added integration tests for representative gated routes verifying 403 PAYWALL for non-subscribers, 200 for valid grace cookies, and 200 for authenticated subscribers.
- **Environment Variable**: Added `GRACE_COOKIE_SECRET` environment variable requirement for grace cookie HMAC signing. Must be set in production for grace cookie functionality.
- **Billing Access Gate**: Added server-side subscription access utility (`lib/billing/access.ts`) with `isSubscriber()` and `requireSubscriber()` functions. Includes feature flag support via `BILLING_ENFORCEMENT` env var (`off` or `active_required`), per-user LRU cache with TTL (60s for positive results, 30s for negative), and structured logging/analytics for paywall blocks.
- **Billing Grace Cookie Support**: Added HMAC-signed cookie utilities (`lib/billing/grace-cookie.ts`) for checkout success grace period. Cookie expires in 15 minutes, uses `PAYWALL_SIGNING_SECRET` for signing, and supports both NextRequest and standard Request objects.
- **Billing Config**: Added `lib/config/billing.ts` with `getBillingEnforcement()` function to read `BILLING_ENFORCEMENT` environment variable (defaults to `off`).
- **Gate Analytics Events**: Added analytics events for paywall gate interactions: `gate_viewed`, `gate_cta_clicked`, `gate_dismissed`, `entitlement_check_failed`.
- **Billing Access Tests**: Added comprehensive unit tests for subscription status checking, TTL caching behavior, feature flag enforcement, and grace cookie integration (`__tests__/billing.access.test.ts`).
- **Grace Cookie Tests**: Added unit tests for cookie signing/verification, expiration handling, and tamper detection (`__tests__/billing.grace-cookie.test.ts`).
- **Billing Analytics Enhancements**: Added comprehensive analytics tracking properties (`tier_name`, `payment_mode`, `plan_type`) to checkout events (`CHECKOUT_INITIATED`, `CHECKOUT_SESSION_CREATED`, `CHECKOUT_ERROR`) and trial events (`trial_started`) for accurate revenue attribution and conversion tracking (TES-350)
- **Pricing Analytics Helpers**: Created `lib/pricing/price-utils.ts` with helper functions to extract tier names, payment modes, and plan types from Stripe price IDs
- **Pricing Page E2E Tests**: Added comprehensive Playwright tests for pricing page covering button states, billing interval toggle, exam packages section, and checkout redirects for authenticated and unauthenticated users (TES-348)
- **PricingCard Unit Tests**: Added unit tests for PricingCard component covering button enabled/disabled states based on price ID presence, loading states, and checkout handler invocation (TES-348)
- **Trial API Tests**: Added comprehensive test suite for trial API endpoint covering default Pro Monthly tier selection, optional tier override, duplicate trial prevention, active subscription checks, database persistence, and user metadata updates (TES-347)
- **Checkout API Tests**: Added comprehensive test suite for checkout API covering price ID validation, payment mode detection, and subscription check logic (TES-345)
- **Stripe Webhook Handlers**: Added handlers for recurring subscription renewals (`invoice.paid` / `invoice.payment_succeeded`) to track monthly/yearly subscription payments
- **One-Time Payment Support**: Added one-time payment handling in `checkout.session.completed` webhook for exam packages and other one-time products
- **Subscription Creation Tracking**: Added optional `customer.subscription.created` handler for explicit subscription creation tracking
- **Webhook Tests**: Added comprehensive unit tests for invoice.paid, invoice.payment_succeeded, and one-time payment checkout flows
- **Stripe Integration**: Added support for all subscription tiers (Basic, Pro, All-Access) and one-time exam packages (3-month, 6-month, 12-month)
- **Stripe Price IDs Documentation**: Created `docs/deployment/stripe-price-ids.md` with all canonical price IDs for test and production environments
- **Dynamic Checkout Modes**: StripeService now automatically detects and handles both subscription and one-time payment checkout modes
- **Price Validation**: Enhanced price ID validation to include all 9 required Stripe price IDs (6 subscription + 3 exam packages)
- **Documentation**: Created comprehensive documentation index at `/docs/README.md` for easy navigation
- **Documentation Organization**: Established new folder structure for better documentation organization:
  - `/docs/strategy/` - Product vision, metrics, revenue model, and business strategy documents
  - `/docs/deployment/` - Deployment guides and setup documentation
  - `/docs/development/` - Development guidelines and AI assistant instructions
  - `/docs/testing/` - Testing guidelines and best practices
- **Enhanced README**: Updated root README.md with improved project description, setup instructions, and clear navigation to documentation
- **Security**: Created `.local/` folder for secure local development files (secrets, keys, etc.)

### Changed
- **Practice Question Filters**: Added optional query parameters to `GET /api/questions/current`: `topic?`, `difficulty? (1-5)`, `hasExplanation? (default true)`. Filters work together with AND semantics. Always scopes to `is_diagnostic_eligible=true` to leverage partial indexes. Supports filtering by topic and/or difficulty, with `hasExplanation=false` allowing questions without explanations.
- **Question Exclusion Parameter**: `GET /api/questions/current` now supports optional `excludeIds` query parameter (comma-separated list) to skip recently seen questions. When provided, the API performs a deterministic circular scan from the calculated rotation index, skipping excluded IDs. Returns 404 with helpful error message if all candidates are excluded. Practice UI automatically tracks last 7 served question IDs and includes them in `excludeIds` when fetching the next question to avoid immediate repeats.
- **Dashboard Practice Stats**: Dashboard API now computes and returns practice statistics (`totalQuestionsAnswered`, `correctAnswers`, `accuracyPercentage`, `lastPracticeDate`) from `practice_attempts` table. Practice accuracy is integrated into readiness score calculation using 60/40 weighting (60% diagnostic, 40% practice). Uses efficient count-based queries for performance (no row fetching, leverages `practice_attempts_user_answered_at_idx` index).
- **Practice Attempts Persistence**: Added `practice_attempts` table with RLS (authenticated users can insert and select only their own rows) and indexes for dashboard queries. Submit endpoint now persists minimal attempt row with snapshot of topic and difficulty; failures are logged server-side and do not affect feedback response.
- **Practice Submit and Dashboard Tests**: Added minimal integration tests for practice submit feedback (`__tests__/api.questions.submit-feedback.test.ts`) verifying POST `/api/questions/submit` returns expected `{ isCorrect, correctOptionKey, explanationText }` structure, and dashboard integration test (`__tests__/api.dashboard.integration.test.ts`) verifying practice stats populate correctly after one attempt and readiness score reflects practice when diagnostic data is present.
- **Practice API Filter**: `/api/questions/current` now serves only questions that have corresponding explanations in the database. Returns 404 with clear error message when no eligible questions exist. Adds lightweight logging for observability when no eligible questions are found.
- **Navigation CTAs**: Replaced "Join Waitlist" CTAs in navigation (desktop and mobile) with "Get Started" button pointing to `/signup` for standard SaaS sign-up flow
- **Navigation Menu**: Added "Pricing" link to main navigation menu to support purchase decisions as per SaaS best practices
- **Theme Default**: Changed default theme from "system" to "light" mode for better consistency across all users
- **CTA Color System**: Unified accent CTA color system to use brand orange (`--tone-accent`) consistently across all button variants. Solid accent buttons now use orange backgrounds with white text (`--tone-accent-foreground`), outline/ghost variants use orange text/borders with orange-tinted hover states, ensuring proper contrast and brand consistency in both light and dark modes
- **Webhook Event Configuration**: Updated webhook documentation to reflect Checkout-only payment flow (removed `payment_intent.*` events from required list)
- **Event Naming**: Clarified that `invoice.paid` or `invoice.payment_succeeded` can be used depending on Stripe account configuration
- **Stripe Setup Documentation**: Updated `docs/deployment/stripe-setup.md` with all products and required environment variables
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process

### Fixed
- **Submit Endpoint Error Handling**: Fixed Supabase error handling in practice attempts insert to properly detect and log failures using error response destructuring instead of try-catch
- **Submit Endpoint Validation**: Added numeric validation for questionId to prevent NaN values in database inserts
- **QuestionData.id Type Consistency**: Fixed type mismatch between client (expects string) and API (returned numeric) for QuestionData.id. All question and option IDs are now serialized as strings at API boundaries to prevent bigint precision issues and align with client types. Added serializeQuestion helper to ensure consistent ID serialization across all question endpoints
- **Card Header Spacing**: Fixed excessive vertical spacing under Dashboard "Diagnostic Tests" card header by removing default bottom margin from CardTitle component. Header spacing is now controlled solely by CardHeader padding/gap, ensuring consistent visual rhythm across all dashboard cards (Exam Readiness, Practice Questions, Diagnostic Tests)
- **Pricing Button State**: Fixed PricingCard component to disable "Get started" button when Stripe price IDs are missing, ensuring consistent behavior with exam package buttons (TES-348)
- **Stripe Checkout Validation**: Fixed checkout API to validate all 9 price IDs from pricing constants instead of only Pro tier
- **One-Time Payments**: Removed subscription-only restriction, allowing users to purchase exam packages even if they have an active subscription
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing

### Removed
- **Claude Code Review Action**: Removed automated Claude code review workflow (`.github/workflows/claude-code-review.yml`) that ran on pull requests
- **Obsolete Files**: Cleaned up root directory by removing:
  - `0_Code Quality.txt` - GitHub Actions log file
  - `implement/` folder - Temporary task tracking (completed work)
  - `tasks/` folder - Ad-hoc task lists (completed work)
- **Root Clutter**: Moved documentation files from root to organized `/docs` folders

### Moved
- Strategic documents to `/docs/strategy/`:
  - `product-vision.md` ? `docs/strategy/product-vision.md`
  - `metrics-kpis.md` ? `docs/strategy/metrics-kpis.md`
  - `revenue-model.md` ? `docs/strategy/revenue-model.md`
  - `risks-assumptions.md` ? `docs/strategy/risks-assumptions.md`
  - `dashboard_mvp_overview.md` ? `docs/strategy/dashboard-mvp-overview.md`
- Deployment guides to `/docs/deployment/`:
  - `DEPLOYMENT.md` ? `docs/deployment/deployment-guide.md`
  - `STRIPE_SETUP.md` ? `docs/deployment/stripe-setup.md`
- Development documents to `/docs/development/`:
  - `system-instructions.md` ? `docs/development/ai-system-instructions.md`
- Data files to `/data/seo/`:
  - `Google Certification Matching Terms Aug 7 2025.csv` ? `data/seo/`
- Security key to `.local/`:
  - `github-actions-key.json` ? `.local/github-actions-key.json`
- Design system docs to `/docs/design-system/`:
  - `dark-mode-audit.md` ? `docs/design-system/dark-mode-audit.md`
  - `dark-mode-setup.md` ? `docs/design-system/dark-mode-setup.md`
  - `ds-migration-report.md` ? `docs/design-system/migration-report.md`
- Payment integration doc to `/docs/deployment/`:
  - `PAYMENT_INTEGRATION.md` ? `docs/deployment/payment-integration.md`
- Refactor docs to `/docs/refactors/`:
  - `pr-008-section-primitive.md` ? `docs/refactors/pr-008-section-primitive.md`
- Testing docs to `/docs/testing/`:
  - `testing-a11y.md` ? `docs/testing/accessibility-testing.md`