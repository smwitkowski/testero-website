# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- **Stripe Checkout Validation**: Fixed checkout API to validate all 9 price IDs from pricing constants instead of only Pro tier
- **One-Time Payments**: Removed subscription-only restriction, allowing users to purchase exam packages even if they have an active subscription
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing

### Changed
- **Webhook Event Configuration**: Updated webhook documentation to reflect Checkout-only payment flow (removed `payment_intent.*` events from required list)
- **Event Naming**: Clarified that `invoice.paid` or `invoice.payment_succeeded` can be used depending on Stripe account configuration
- **Stripe Setup Documentation**: Updated `docs/deployment/stripe-setup.md` with all products and required environment variables
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process