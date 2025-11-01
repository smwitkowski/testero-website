# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Practice Attempts Persistence**: Added `practice_attempts` table with RLS (authenticated users can insert and select only their own rows) and indexes for dashboard queries. Submit endpoint now persists minimal attempt row with snapshot of topic and difficulty; failures are logged server-side and do not affect feedback response.

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

### Fixed
- **QuestionData.id Type Consistency**: Fixed type mismatch between client (expects string) and API (returned numeric) for QuestionData.id. All question and option IDs are now serialized as strings at API boundaries to prevent bigint precision issues and align with client types. Added serializeQuestion helper to ensure consistent ID serialization across all question endpoints
- **Card Header Spacing**: Fixed excessive vertical spacing under Dashboard "Diagnostic Tests" card header by removing default bottom margin from CardTitle component. Header spacing is now controlled solely by CardHeader padding/gap, ensuring consistent visual rhythm across all dashboard cards (Exam Readiness, Practice Questions, Diagnostic Tests)
- **Pricing Button State**: Fixed PricingCard component to disable "Get started" button when Stripe price IDs are missing, ensuring consistent behavior with exam package buttons (TES-348)
- **Stripe Checkout Validation**: Fixed checkout API to validate all 9 price IDs from pricing constants instead of only Pro tier
- **One-Time Payments**: Removed subscription-only restriction, allowing users to purchase exam packages even if they have an active subscription
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing

### Removed
- **Obsolete Files**: Cleaned up root directory by removing:
  - `0_Code Quality.txt` - GitHub Actions log file
  - `implement/` folder - Temporary task tracking (completed work)
  - `tasks/` folder - Ad-hoc task lists (completed work)
- **Root Clutter**: Moved documentation files from root to organized `/docs` folders

### Moved
- Strategic documents to `/docs/strategy/`:
  - `product-vision.md` → `docs/strategy/product-vision.md`
  - `metrics-kpis.md` → `docs/strategy/metrics-kpis.md`
  - `revenue-model.md` → `docs/strategy/revenue-model.md`
  - `risks-assumptions.md` → `docs/strategy/risks-assumptions.md`
  - `dashboard_mvp_overview.md` → `docs/strategy/dashboard-mvp-overview.md`
- Deployment guides to `/docs/deployment/`:
  - `DEPLOYMENT.md` → `docs/deployment/deployment-guide.md`
  - `STRIPE_SETUP.md` → `docs/deployment/stripe-setup.md`
- Development documents to `/docs/development/`:
  - `system-instructions.md` → `docs/development/ai-system-instructions.md`
- Data files to `/data/seo/`:
  - `Google Certification Matching Terms Aug 7 2025.csv` → `data/seo/`
- Security key to `.local/`:
  - `github-actions-key.json` → `.local/github-actions-key.json`
- Design system docs to `/docs/design-system/`:
  - `dark-mode-audit.md` → `docs/design-system/dark-mode-audit.md`
  - `dark-mode-setup.md` → `docs/design-system/dark-mode-setup.md`
  - `ds-migration-report.md` → `docs/design-system/migration-report.md`
- Payment integration doc to `/docs/deployment/`:
  - `PAYMENT_INTEGRATION.md` → `docs/deployment/payment-integration.md`
- Refactor docs to `/docs/refactors/`:
  - `pr-008-section-primitive.md` → `docs/refactors/pr-008-section-primitive.md`
- Testing docs to `/docs/testing/`:
  - `testing-a11y.md` → `docs/testing/accessibility-testing.md`