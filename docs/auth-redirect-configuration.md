# Supabase Auth Redirect Configuration

This document outlines how Supabase authentication redirects are configured for email verification and password reset flows.

## Environment Variables

### Required Variables

The following environment variable must be set for proper redirect configuration:

```bash
# For local development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# For production (should be set in deployment environment)
NEXT_PUBLIC_SITE_URL=https://testero.ai
```

### Redirect URLs

Based on the `NEXT_PUBLIC_SITE_URL` environment variable, the following redirects are configured:

- **Email Verification**: `{SITE_URL}/verify-email`
- **Password Reset**: `{SITE_URL}/reset-password`

## Implementation

### Email Verification Flow

1. User signs up via `/signup` page or `/api/auth/signup` endpoint
2. Supabase sends confirmation email with link to `/verify-email`
3. User clicks link and is redirected to `/verify-email` page
4. Page parses access_token from URL hash and sets session
5. User is redirected to `/dashboard` on success

### Password Reset Flow

1. User requests password reset via `/forgot-password` page
2. API calls `/api/auth/password-reset` endpoint
3. Supabase sends reset email with link to `/reset-password`
4. User clicks link and is redirected to `/reset-password` page
5. Page verifies session and shows password reset form
6. User sets new password and is redirected to `/login`

## Code Locations

### Signup Configuration

- **API Handler**: `lib/auth/signup-handler.ts` - Line 82
- **Client Page**: `app/signup/page.tsx` - Line 57

```typescript
const { error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    data: { early_access: false },
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
  },
});
```

### Password Reset Configuration

- **API Handler**: `app/api/auth/password-reset/route.ts` - Line 67

```typescript
const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
});
```

## Pages Created

### `/verify-email`
- **Component**: `app/verify-email/page.tsx`
- **Metadata**: `app/verify-email/page.metadata.tsx`
- **Tests**: `__tests__/verify-email.page.test.tsx`

Handles email confirmation tokens from Supabase auth URLs.

### `/reset-password`
- **Component**: `app/reset-password/page.tsx`
- **Metadata**: `app/reset-password/page.metadata.tsx`

Allows users to set a new password after clicking reset link.

## Deployment Configuration

For production deployment, ensure the `NEXT_PUBLIC_SITE_URL` environment variable is set to the production domain in your deployment configuration:

### Google Cloud Run

Add to `cloudbuild.yaml` env vars:
```yaml
--set-env-vars=NODE_ENV=production,NEXT_PUBLIC_SITE_URL=https://testero.ai
```

### Other Platforms

Set environment variable according to platform requirements:
- Vercel: Add to environment variables in dashboard
- Netlify: Add to site settings environment variables
- Docker: Pass via `-e` flag or docker-compose environment section

## Supabase Dashboard Configuration

In your Supabase project dashboard, ensure the following URLs are added to the "Redirect URLs" list in Authentication > URL Configuration:

- `http://localhost:3000/verify-email` (for local development)
- `http://localhost:3000/reset-password` (for local development)
- `https://testero.ai/verify-email` (for production)
- `https://testero.ai/reset-password` (for production)

## Testing

The redirect configuration is tested in:
- `__tests__/api.password-reset.test.ts` - Environment variable handling
- `__tests__/verify-email.page.test.tsx` - Email verification flow
- `__tests__/api.signup.test.ts` - Signup flow (business logic)

## Troubleshooting

### Common Issues

1. **Redirects to wrong URL**: Check `NEXT_PUBLIC_SITE_URL` environment variable
2. **Email links don't work**: Verify Supabase redirect URLs configuration
3. **Session not found**: Ensure user clicked the most recent email link
4. **Invalid token errors**: Check token expiration and URL integrity

### Debug Steps

1. Check browser console for errors on auth pages
2. Verify environment variables are set correctly
3. Confirm Supabase dashboard URL configuration
4. Test with fresh email confirmation or password reset