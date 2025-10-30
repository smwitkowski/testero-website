# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Documentation**: Created comprehensive documentation index at `/docs/README.md` for easy navigation
- **Documentation Organization**: Established new folder structure for better documentation organization:
  - `/docs/strategy/` - Product vision, metrics, revenue model, and business strategy documents
  - `/docs/deployment/` - Deployment guides and setup documentation
  - `/docs/development/` - Development guidelines and AI assistant instructions
  - `/docs/testing/` - Testing guidelines and best practices
- **Enhanced README**: Updated root README.md with improved project description, setup instructions, and clear navigation to documentation
- **Security**: Created `.local/` folder for secure local development files (secrets, keys, etc.)

### Fixed
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing

### Changed
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process

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