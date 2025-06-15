# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Build Failure**: Fixed ESLint error `react/no-unescaped-entities` in `app/signup/page.tsx` by escaping apostrophe in "We've" text using HTML entity `&#39;`
- **Build Environment**: Added placeholder Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to allow build completion
- **Dependencies**: Resolved missing build dependencies (`ts-node`, `prettier`) that were preventing the build process from completing
- **Database Query**: Fixed diagnostic summary API error by removing `.order('created_at')` clause that referenced non-existent column in diagnostic_questions table
- **Diagnostic Summary**: Fixed duplicate check marks when user answers correctly - now shows only "Your Answer" with single check mark instead of both "Correct" and "Your Answer"
- **Diagnostic Summary**: Fixed alignment issues between "Correct" and "Your Answer" tags by using consistent flexbox layout with proper spacing

### Changed
- Production build now successfully generates optimized static content for all 26 pages
- Sitemap generation now handles missing Supabase connection gracefully during build process

### Improved
- **Diagnostic Question Layout**: Completely redesigned diagnostic question page for better space utilization and readability
  - Increased container width from 600px to 900px for more breathing room
  - Enhanced question stem presentation with larger padding (2rem), background container, and improved typography
  - Increased spacing throughout the interface (3rem margins, larger gaps between elements)
  - Improved button sizing and enhanced hover animations while preserving existing button interactions
  - Added colored feedback containers for correct/incorrect answers with emoji indicators
  - Better visual hierarchy with improved header layout and typography scaling