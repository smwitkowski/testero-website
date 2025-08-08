# Stripe Setup for Trial Conversion

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe API Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Stripe Price IDs (create products at https://dashboard.stripe.com/test/products)
NEXT_PUBLIC_STRIPE_PRO_MONTHLY=price_your_pro_monthly_id
NEXT_PUBLIC_STRIPE_PRO_YEARLY=price_your_pro_yearly_id

# Webhook Secret (for production - get from webhook endpoint settings)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

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
