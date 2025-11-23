# Stripe Setup for Trial Conversion

## Required Environment Variables

### Local Development

Add these to your `.env.local` file:

```bash
# Stripe API Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Stripe Price IDs (see docs/deployment/stripe-price-ids.md for actual values)
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=price_1SNkDtRqq8mPUhEry3BHJl1K
NEXT_PUBLIC_STRIPE_BASIC_ANNUAL=price_1SNkDvRqq8mPUhErb1atjbrv
NEXT_PUBLIC_STRIPE_PRO_MONTHLY=price_1SNkE1Rqq8mPUhErlkNKsMpA
NEXT_PUBLIC_STRIPE_PRO_ANNUAL=price_1SNkE2Rqq8mPUhEr22dHvDgC
NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY=price_1SNkE6Rqq8mPUhErJyWYqzQM
NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL=price_1SNkE7Rqq8mPUhErRL63Fu3d

# Webhook Secret (for production - get from webhook endpoint settings)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Grace Cookie Signing Secret (for checkout success grace window)
# Generate a secure random string (32+ characters recommended)
PAYWALL_SIGNING_SECRET=your_secure_random_secret_here
```

### Production Deployment (Cloud Run)

The `NEXT_PUBLIC_STRIPE_*` environment variables are wired through the CI/CD pipeline:

1. **GitHub Actions** (`.github/workflows/deploy-to-cloud-run.yml`):
   - Stripe price IDs are passed as Docker build arguments during image build
   - They are also set as Cloud Run environment variables at deployment time
   - Ensure GitHub repository secrets are configured:
     - `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY`
     - `NEXT_PUBLIC_STRIPE_BASIC_ANNUAL`
     - (and other Stripe price IDs as needed)

2. **Verifying Cloud Run Environment Variables**:
   ```bash
   # Check configured env vars on Cloud Run service
   gcloud run services describe testero-frontend --region=us-central1 \
     --format='yaml(spec.template.spec.containers[0].env)'
   
   # Or list all env vars
   gcloud run services describe testero-frontend --region=us-central1 \
     --format='value(spec.template.spec.containers[0].env)'
   ```

3. **Checking for Missing Price ID Errors**:
   ```bash
   # Search Cloud Run logs for missing price ID errors
   gcloud logging read "resource.type=cloud_run_revision AND \
     resource.labels.service_name=testero-frontend AND \
     textPayload=~'missing_basic_monthly_price_id'" \
     --limit=50 --format=json
   ```

**Note**: Missing `NEXT_PUBLIC_STRIPE_BASIC_*` environment variables will **not** break anonymous signup flows (users will still be redirected to `/signup`), but will prevent authenticated users from initiating checkout. Always ensure these are configured in production.

## Setup Steps

1. **Create a Stripe Account**

   - Go to https://stripe.com and sign up
   - Use test mode for development

2. **Get API Keys**

   - Navigate to Developers → API keys
   - Copy the test publishable and secret keys

3. **Create Products and Prices**

   - Go to Products → Add product
   - Create a "Pro" subscription product
   - Add monthly and yearly pricing
   - Copy the price IDs (starts with `price_`)

4. **Configure Environment**
   - Copy `.env.example` to `.env.local`
   - Add your Stripe keys and price IDs

## Testing the Trial Flow

1. Start the dev server: `npm run dev`
2. Complete a diagnostic test
3. On the summary page, the trial modal will appear after 5 seconds
4. Click "Start 14-Day Free Trial"
5. If not logged in, you'll be redirected to signup
6. After signup/login, the trial will be created

## Troubleshooting

### "Payment system not configured" Error

- Ensure `STRIPE_SECRET_KEY` is set in `.env.local`
- Restart the dev server after adding environment variables

### "Invalid subscription plan" Error

- Verify the price IDs are correct
- Ensure the prices are active in your Stripe dashboard

### Rate Limiting Errors

- The trial endpoint is rate-limited to 3 requests per minute
- Wait 60 seconds before retrying

## Database Requirements

The following tables must exist:

- `user_subscriptions` - Stores subscription data
- `auth.users` - User authentication (managed by Supabase)

Run the migration if needed:

```sql
-- Add trial-related fields
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_ends_at
ON user_subscriptions(trial_ends_at)
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trialing
ON user_subscriptions(status)
WHERE status = 'trialing';
```
