# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- SEO: Added upload-ready Ahrefs keyword CSVs for Google Cloud certifications:
  - `docs/seo/ahrefs_pmle_keywords.csv` (PMLE-specific)
  - `docs/seo/ahrefs_gcp_bofu.csv` (high-intent practice/test terms)
  - `docs/seo/ahrefs_gcp_mofu.csv` (study/guide/topics terms)
  - `docs/seo/ahrefs_gcp_tofu.csv` (awareness/overview terms)

### Fixed
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing

### Changed
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process