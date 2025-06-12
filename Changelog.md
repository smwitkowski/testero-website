## [Unreleased]
- Added `/api/auth/signup` API route for Supabase sign-up with email/password, default `early_access: false` metadata, and clean JSON responses.
- Implemented in-memory rate limiting (5 requests/minute per IP) for sign-up route. Added comments for production upgrade.
- Added server-side PostHog instrumentation for signup attempts, success, errors, and rate limiting.
- Added Jest tests for signup API covering valid, invalid, rate-limited, and duplicate email scenarios. 