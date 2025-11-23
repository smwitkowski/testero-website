# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Readiness Copy and Empty States**: Polished readiness-related copy and empty states across Diagnostic Results and Dashboard to align with Testero's readiness assistant positioning. Updated all readiness tier descriptions to be more constructive and guidance-focused. Standardized "Pass typically ≥70%" messaging using shared `READINESS_PASS_THRESHOLD` constant. Improved dashboard empty state copy to emphasize readiness-first language and domain-specific guidance. Enhanced diagnostic summary 0-score handling with constructive messaging ("This was your first attempt. Here's where to start building your foundation."). Added legacy session handling for diagnostics without domain breakdown, showing explanatory message and fallback study plan. Updated study plan descriptions to be more actionable and aligned with domain tier story. Updated retake guidance tip to use canonical pass threshold (≥70%) instead of hard-coded value. Dashboard header subtitle updated to "Track your readiness and get domain-specific study guidance" to better reflect positioning.

### Added
- **Weekly Free Practice Quota**: Implemented a free weekly practice quota for non-subscriber users (1 session of 5 questions per week for PMLE). Created `practice_quota_usage` table and `check_and_increment_practice_quota` RPC function for atomic quota tracking. Updated `/api/practice/session` to enforce quota limits for free tier users, returning a structured `FREE_QUOTA_EXCEEDED` error when limits are reached. Enhanced Diagnostic Summary page to handle quota errors by showing a targeted "Weekly Free Limit Reached" upsell prompt. Added comprehensive unit and integration tests for quota logic and API enforcement. Added `PRACTICE_QUOTA_EXCEEDED` analytics event for tracking paywall hits.

- **Dashboard Readiness Summary Endpoint**: Added new API endpoint (`GET /api/dashboard/summary?examKey=pmle`) that returns PMLE exam readiness based on the user's latest completed diagnostic. Endpoint identifies the latest completed PMLE diagnostic session, calculates the overall score from diagnostic responses, and returns readiness tier using `getExamReadinessTier()`. Response includes `currentReadinessScore`, `currentReadinessTier`, `lastDiagnosticDate`, `lastDiagnosticSessionId`, `totalDiagnosticsCompleted`, and `hasCompletedDiagnostic` flag. Returns empty state (score 0, tier null) when no completed diagnostics exist. Added comprehensive Jest tests covering authentication, empty state, valid diagnostic scenarios, error handling, and tier calculation for different score ranges.
- **Dashboard Readiness Card Enhancement**: Updated Dashboard Exam Readiness card (`ReadinessMeter` component) to consume the new readiness summary endpoint and display diagnostic-based readiness. Card now shows explanatory text ("Based on your latest diagnostic") with formatted date when a completed diagnostic exists, includes "View results" link to the latest diagnostic summary page, and displays empty state with "Get started" label and "Take your first diagnostic" CTA when no diagnostics exist. Empty state CTA is wired to diagnostic session creation flow. Added React Testing Library tests covering populated and empty states, CTA behavior, tier display, and navigation links. Added Playwright E2E tests validating dashboard readiness behavior with and without completed PMLE diagnostics, including navigation to diagnostic summary pages.

### Changed
- **Practice Session API for Domain-Targeted Question Sets**: Added new backend API (`POST /api/practice/session`) to create short, domain-targeted practice sessions (e.g., 10-question sets) based on weak domains from diagnostic results. New database tables `practice_sessions` and `practice_questions` mirror the diagnostic snapshot pattern for consistency. Domain-based question selection (`lib/practice/domain-selection.ts`) distributes questions evenly across requested domains with fallback when domains have insufficient questions. API requires authentication, enforces rate limiting, and returns session ID with route for frontend navigation. Added comprehensive Jest tests covering validation, authentication, error handling, and domain distribution scenarios.
- **Diagnostic Results Practice Session CTAs**: Wired Diagnostic Results page CTAs to create domain-targeted practice sessions via `/api/practice/session`. Top CTA ("Start 10-min practice on your weakest topics") automatically identifies the weakest 2-3 domains from diagnostic results and creates a 10-question practice session. Study Plan per-domain CTAs ("Start practice (10)") create single-domain practice sessions. Both CTAs navigate users to the practice session route returned by the API. Added error handling with friendly toast notifications for API failures, loading states on buttons during session creation, and analytics tracking (`practice_session_created_from_diagnostic` and `practice_session_creation_failed_from_diagnostic` events). Added comprehensive unit tests covering weakest-domain selection logic, API integration, error handling, and premium gating. Added E2E tests covering successful practice session creation flows and error scenarios.
- **Shared Readiness Tier Helpers**: Added centralized readiness tier helpers (`lib/readiness.ts`) with `getExamReadinessTier()` and `getDomainTier()` functions. Exam readiness tiers: Low (<40), Building (40-69), Ready (70-84), Strong (85+). Domain tiers: Critical (<40), Moderate (40-69), Strong (70+). Thresholds are explicitly defined and documented. Diagnostic Results page (`app/diagnostic/[sessionId]/summary/page.tsx`) and Dashboard ReadinessMeter component (`components/dashboard/ReadinessMeter.tsx`) now use these helpers for consistent readiness labels and domain tier display. Added comprehensive unit tests (`__tests__/lib/readiness.test.ts`) covering all tier boundaries and edge cases.

### Changed
- **Diagnostic Results Readiness Labels**: Updated Diagnostic Results page to use shared `getExamReadinessTier()` helper instead of inline `getReadinessLabel()` function. Readiness labels now consistently use "Low", "Building", "Ready", "Strong" across Diagnostic Results and Dashboard.
- **Diagnostic Study Plan Domain Tiers**: Updated Study Plan component to use shared `getDomainTier()` helper instead of inline threshold logic. Domain tier badges now consistently use "Critical", "Moderate", "Strong" labels.
- **Dashboard Readiness Display**: Updated Dashboard ReadinessMeter component to use shared `getExamReadinessTier()` helper instead of separate `getReadinessColor()`, `getReadinessText()`, and `getReadinessDescription()` functions. Dashboard now displays consistent readiness labels matching Diagnostic Results.

### Fixed
- **Readiness Color Consistency**: Fixed inconsistent color mapping between Diagnostic Summary page and Dashboard ReadinessMeter component. Added shared color mapping functions (`getExamReadinessTierColors()`, `getDomainTierColors()`, `getExamReadinessSemanticColor()`) to `lib/readiness.ts` ensuring consistent color scheme across all components: Low→Red, Building→Orange, Ready→Blue, Strong→Green for exam readiness; Critical→Red, Moderate→Amber, Strong→Green for domains. Updated Diagnostic Summary page to use static Tailwind class helper function instead of dynamic string interpolation (which Tailwind JIT compiler cannot detect). Updated Dashboard ReadinessMeter to use shared semantic color function for inline styles.
- **Diagnostic Summary Explanations**: Fixed diagnostic summary page (`/diagnostic/[sessionId]/summary`) to display question explanations in the Question Review section. The summary API now fetches canonical explanations from `public.explanations` table in bulk and attaches them to each question. Missing explanations are logged with structured warnings for content cleanup. Note: For canonical PMLE sessions, explanation support is currently limited due to schema type mismatch (`diagnostic_questions.original_question_id` is `bigint` while canonical `questions.id` is `uuid`). This will be addressed in a future schema migration.

### Added
- **PMLE Diagnostic Canonical Blueprint Selection**: Diagnostic session creation for PMLE exams now uses canonical questions schema (`questions`, `answers`, `exam_domains`) with blueprint-weighted domain selection. Questions are filtered by `exam = 'GCP_PM_ML_ENG'` and `status = 'ACTIVE'`, then selected using `PMLE_BLUEPRINT` domain weights with intelligent redistribution when domains have insufficient inventory. Both `/api/diagnostic` (primary endpoint) and `/api/diagnostic/session` (beta endpoint) use `selectPmleQuestionsByBlueprint()` for PMLE diagnostics. Question snapshots in `diagnostic_questions` now include `domain_id` and `domain_code` for analytics.
- **Diagnostic Canonical Explanations**: Diagnostic answer flow (`POST /api/diagnostic` with `action: "answer"`) now sources explanations exclusively from canonical `public.explanations` table, queried via `original_question_id` from question snapshots. Missing canonical explanations return `explanation: null` in the response (rather than fallback messages) and are logged for cleanup. Legacy `explanations_legacy` table lookups have been removed. For non-canonical or historical sessions where no canonical explanation exists, the endpoint gracefully returns `null` rather than querying legacy tables.
- **Snapshot Canonical Domain Info into Diagnostic Questions**: Each `diagnostic_questions` row now carries `domain_id` (UUID FK to `exam_domains.id`) and `domain_code` (TEXT matching `exam_domains.code`) as snapshots from canonical questions at session creation time. This enables domain breakdown calculations and future readiness metrics to be computed directly from `diagnostic_questions` without rejoining canonical tables. Migration `20250120_add_domain_fields_to_diagnostic_questions.sql` adds these nullable fields with indexes for performance. Added unit tests verifying canonical domain breakdown computation without table joins.
- **Diagnostic Summary Domain Breakdown from Snapshots**: The diagnostic summary endpoint (`GET /api/diagnostic/summary/[sessionId]`) now computes domain breakdown entirely from `diagnostic_questions.domain_code` and `diagnostic_responses.is_correct` with no legacy `questions` table joins. Domain labels are derived from canonical PMLE blueprint config via `getPmleDomainConfig(domain_code)`. For non-canonical or older sessions where all questions have `domain_code = null`, `domainBreakdown` returns an empty array. Removed all legacy topic-based fallback logic.
- **PMLE Domain Backfill**: Added backfill script (`scripts/backfill-pmle-domains.ts`) to map legacy topic-based domain codes to canonical blueprint domains. Script creates blueprint domains if missing, updates `questions.domain_id` for all ACTIVE PMLE questions, supports dry-run mode, and includes comprehensive logging. Added domain mapping module (`lib/diagnostic/pmle-domain-mapping.ts`) with helper functions for legacy-to-blueprint mapping. Extended validation script (`scripts/validate-pmle-domains.ts`) to fail fast on validation errors and check for invalid domain references. Added domain mapping documentation (`docs/pmle-domain-mapping.md`) with complete mapping table and rationale. Added SQL validation queries (`docs/sql/pmle-domain-check.sql`) to verify blueprint domain coverage and distribution. Added unit tests for mapping functions (`__tests__/lib/diagnostic/pmle-domain-mapping.test.ts`). Updated migration documentation (`docs/pmle-migration.md`) with backfill runbook and acceptance criteria.

### Improved
- **Diagnostic Debug Logging**: Added environment-gated debug logging for PMLE diagnostic domain distributions. When `DIAGNOSTIC_BLUEPRINT_DEBUG=true`, endpoints log session ID and high-level domain distribution (selected vs target counts) for quick inspection without noisy production logs.

### Fixed
- **Linting Issues**: Fixed all TypeScript `any` type errors in diagnostic summary API route and PMLE selection logic by adding proper type interfaces. Fixed `no-restricted-syntax` warnings for Section component usage by adding appropriate eslint-disable comments. Removed unused `request` parameter from billing status route.

### Added
- **CI Automation**: Added `Justfile` with `just ci` command to run all CI checks locally (lint, eslint-rules, type-check) for easier pre-commit validation.

### Added
- Billing status API endpoint (`GET /api/billing/status`) returning lightweight subscription status for UI decisions only. Server remains authoritative for authorization. No sensitive plan details (plan_id, Stripe IDs, amounts) are returned.
- `useSubscriptionStatus` hook for client-side subscription status with optional SSR-provided initial value, automatic refetch on auth changes, and manual refetch capability.
- Shared subscription status computation helper (`lib/billing/subscription-status.ts`) reused by API and server-side authorization checks.
- **Checkout Grace Window Cookie**: Added 15-minute signed cookie (`checkout_grace`) that grants temporary access after successful Stripe checkout while webhook finalizes. Cookie is set via `/api/billing/checkout/success` endpoint and verified in entitlement gates. Cookie is cleared on first successful entitlement pass or when expired/invalid. Uses `PAYWALL_SIGNING_SECRET` environment variable for HMAC signing (HttpOnly, SameSite=Lax, Secure in production).
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
- **UpgradePrompt Component**: Added minimal premium gate modal component (`components/billing/UpgradePrompt.tsx`) with internal open/close state management. Component accepts optional `featureName` prop and tracks `gate_viewed` on mount, `gate_cta_clicked` when primary CTA navigates to `/pricing`, and `gate_dismissed` when secondary CTA closes modal. All analytics events include route and feature context. Exported `UpgradePromptProps` interface for consumer reusability. Includes comprehensive unit tests covering analytics tracking, modal state, and navigation behavior (P1.4).

### Changed
- **PMLE Blueprint Alignment**: Replaced the interim 24-topic blueprint with the six canonical PMLE domains, updated the in-code documentation, and refreshed the diagnostic selection unit tests to validate weight normalization and domain coverage. This keeps Week 2 diagnostics aligned with the canonical exam blueprint while we wait for the DB-driven editor.
- **Practice Question Filters**: Added optional query parameters to `GET /api/questions/current`: `topic?`, `difficulty? (1-5)`, `hasExplanation? (default true)`. Filters work together with AND semantics. Always scopes to `is_diagnostic_eligible=true` to leverage partial indexes. Supports filtering by topic and/or difficulty, with `hasExplanation=false` allowing questions without explanations.
- **Question Exclusion Parameter**: `GET /api/questions/current` now supports optional `excludeIds` query parameter (comma-separated list) to skip recently seen questions. When provided, the API performs a deterministic circular scan from the calculated rotation index, skipping excluded IDs. Returns 404 with helpful error message if all candidates are excluded. Practice UI automatically tracks last 7 served question IDs and includes them in `excludeIds` when fetching the next question to avoid immediate repeats.
- **Dashboard Practice Stats**: Dashboard API now computes and returns practice statistics (`totalQuestionsAnswered`, `correctAnswers`, `accuracyPercentage`, `lastPracticeDate`) from `practice_attempts` table. Practice accuracy is integrated into readiness score calculation using 60/40 weighting (60% diagnostic, 40% practice). Uses efficient count-based queries for performance (no row fetching, leverages `practice_attempts_user_answered_at_idx` index).
- **Practice Attempts Persistence**: Added `practice_attempts` table with RLS (authenticated users can insert and select only their own rows) and indexes for dashboard queries. Submit endpoint now persists minimal attempt row with snapshot of topic and difficulty; failures are logged server-side and do not affect feedback response.
- **Practice Submit and Dashboard Tests**: Added minimal integration tests for practice submit feedback (`__tests__/api.questions.submit-feedback.test.ts`) verifying POST `/api/questions/submit` returns expected `{ isCorrect, correctOptionKey, explanationText }` structure, and dashboard integration test (`__tests__/api.dashboard.integration.test.ts`) verifying practice stats populate correctly after one attempt and readiness score reflects practice when diagnostic data is present.

### Fixed
- **Submit Endpoint Error Handling**: Fixed Supabase error handling in practice attempts insert to properly detect and log failures using error response destructuring instead of try-catch
- **Submit Endpoint Validation**: Added numeric validation for questionId to prevent NaN values in database inserts

### Changed
- **Practice API Filter**: `/api/questions/current` now serves only questions that have corresponding explanations in the database. Returns 404 with clear error message when no eligible questions exist. Adds lightweight logging for observability when no eligible questions are found.
- **Card Padding Standardization**: Standardized card padding across the site to use responsive design tokens (`p-4 md:p-6` = 16px mobile, 24px desktop). Updated Card component, diagnostic pages, dashboard components, and marketing sections to use consistent spacing following design system scale (--space-md for mobile, --space-lg for desktop)
- **Navigation CTAs**: Replaced "Join Waitlist" CTAs in navigation (desktop and mobile) with "Get Started" button pointing to `/signup` for standard SaaS sign-up flow
- **Navigation Menu**: Added "Pricing" link to main navigation menu to support purchase decisions as per SaaS best practices
- **Theme Default**: Changed default theme from "system" to "light" mode for better consistency across all users
- **CTA Color System**: Unified accent CTA color system to use brand orange (`--tone-accent`) consistently across all button variants. Solid accent buttons now use orange backgrounds with white text (`--tone-accent-foreground`), outline/ghost variants use orange text/borders with orange-tinted hover states, ensuring proper contrast and brand consistency in both light and dark modes
- **Webhook Event Configuration**: Updated webhook documentation to reflect Checkout-only payment flow (removed `payment_intent.*` events from required list)
- **Event Naming**: Clarified that `invoice.paid` or `invoice.payment_succeeded` can be used depending on Stripe account configuration
- **Stripe Setup Documentation**: Updated `docs/deployment/stripe-setup.md` with all products and required environment variables
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process

### Added
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