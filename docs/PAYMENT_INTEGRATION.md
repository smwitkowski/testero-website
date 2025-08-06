# Stripe Payment Integration Documentation

## Overview

This document describes the Stripe payment integration for Testero, enabling subscription-based billing with monthly and yearly plans.

## Architecture

### Components

1. **Database Schema** (`supabase/migrations/`)

   - `subscription_plans` - Available subscription tiers
   - `user_subscriptions` - Active user subscriptions
   - `payment_history` - Transaction records
   - `webhook_events` - Idempotency tracking

2. **API Endpoints**

   - `POST /api/billing/checkout` - Create Stripe checkout sessions
   - `POST /api/billing/portal` - Access Stripe billing portal
   - `POST /api/billing/webhook` - Handle Stripe webhooks

3. **Frontend Pages**

   - `/pricing` - Pricing page with plan selection
   - `/dashboard/billing` - User billing dashboard

4. **Services**
   - `lib/stripe/stripe-service.ts` - Stripe API wrapper
   - `lib/email/email-service.ts` - Email notifications via Resend

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Required Stripe Keys
STRIPE_SECRET_KEY=sk_test_... # From Stripe Dashboard > API Keys
STRIPE_WEBHOOK_SECRET=whsec_... # From Stripe Dashboard > Webhooks
STRIPE_PRICE_ID_MONTHLY=price_... # Created in Stripe Dashboard
STRIPE_PRICE_ID_YEARLY=price_... # Created in Stripe Dashboard
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email Service
RESEND_API_KEY=re_... # From Resend Dashboard
```

### 2. Stripe Dashboard Setup

1. **Create Products & Prices**

   - Go to Stripe Dashboard > Products
   - Create "Testero Subscription" product
   - Add Monthly price ($29/month)
   - Add Yearly price ($290/year)
   - Copy price IDs to `.env.local`

2. **Configure Webhook Endpoint**

   - Go to Stripe Dashboard > Webhooks
   - Add endpoint: `https://yourdomain.com/api/billing/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy webhook secret to `.env.local`

3. **Enable Billing Portal**
   - Go to Stripe Dashboard > Settings > Billing > Customer portal
   - Configure allowed actions (cancel, update payment method)
   - Set cancellation policy

### 3. Database Migration

Run the migration to create billing tables:

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard
# SQL Editor > New Query > Paste migration file
```

### 4. Seed Initial Data (Optional)

```sql
-- Insert subscription plans
-- Replace the price IDs below with your actual Stripe price IDs from environment variables:
-- STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY
INSERT INTO subscription_plans (name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features)
VALUES
  ('Pro', 2900, 29000,
   'YOUR_STRIPE_PRICE_ID_MONTHLY', -- Replace with actual price ID from Stripe Dashboard
   'YOUR_STRIPE_PRICE_ID_YEARLY',  -- Replace with actual price ID from Stripe Dashboard
   '["Unlimited practice questions", "Full diagnostic assessments", "Personalized study plans", "Performance analytics", "Email support"]'::jsonb);
```

## Testing

### Unit Tests

```bash
# Run all billing tests
npm test -- __tests__/api/billing

# Run specific test file
npm test -- __tests__/api/billing/checkout.test.ts
```

### Integration Tests

```bash
npm test -- __tests__/integration/billing-flow.test.ts
```

### Manual Testing with Stripe CLI

1. Install Stripe CLI
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/billing/webhook`
4. Trigger test events: `stripe trigger checkout.session.completed`

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

## Payment Flow

### New Subscription

1. User clicks "Subscribe" on `/pricing`
2. API creates/retrieves Stripe customer
3. Creates checkout session with price ID
4. User redirected to Stripe Checkout
5. Payment processed by Stripe
6. Webhook received at `/api/billing/webhook`
7. Subscription record created in database
8. Email confirmation sent via Resend
9. User redirected to `/dashboard/billing?success=true`

### Subscription Management

1. User visits `/dashboard/billing`
2. Clicks "Manage Subscription"
3. API creates portal session
4. User redirected to Stripe Billing Portal
5. Changes processed by Stripe
6. Webhook updates database

## Security Considerations

1. **Webhook Signature Verification**

   - All webhooks verified using `stripe-signature` header
   - Invalid signatures rejected with 400 status

2. **Idempotency**

   - Webhook events tracked in `webhook_events` table
   - Duplicate events ignored

3. **Rate Limiting**

   - All billing endpoints rate limited (3 req/min)
   - Uses Upstash Redis for distributed limiting

4. **Authentication**

   - All endpoints require authenticated user
   - User ID stored in Stripe metadata

5. **Input Validation**
   - Price IDs validated against environment variables
   - Zod schemas for request validation

## Monitoring

### Key Metrics

- Checkout conversion rate
- Payment success rate
- Subscription churn rate
- Webhook processing time

### PostHog Events

- `checkout_initiated`
- `checkout_completed`
- `checkout_error`
- `billing_portal_requested`
- `subscription_cancelled`

### Error Handling

All errors logged with context:

```typescript
console.error("[Billing] Operation failed:", {
  error: error.message,
  userId: user.id,
  operation: "checkout_session_creation",
  timestamp: new Date().toISOString(),
});
```

## Troubleshooting

### Common Issues

1. **"No subscription found" error**

   - Check if user has `stripe_customer_id` in database
   - Verify subscription status is "active"

2. **Webhook signature verification failed**

   - Ensure `STRIPE_WEBHOOK_SECRET` matches Dashboard
   - Check request isn't modified by proxy/middleware

3. **Payment requires authentication**

   - Normal for EU cards with SCA
   - Stripe handles 3D Secure automatically

4. **Subscription not updating**
   - Check webhook events in Stripe Dashboard
   - Verify webhook endpoint is reachable
   - Check `webhook_events` table for processing status

## API Reference

### POST /api/billing/checkout

Creates a Stripe checkout session.

**Request:**

```json
{
  "priceId": "price_monthly_id"
}
```

**Response:**

```json
{
  "url": "https://checkout.stripe.com/pay/cs_..."
}
```

### POST /api/billing/portal

Creates a Stripe billing portal session.

**Response:**

```json
{
  "url": "https://billing.stripe.com/session/bps_..."
}
```

### POST /api/billing/webhook

Handles Stripe webhook events.

**Headers:**

- `stripe-signature`: Webhook signature for verification

**Supported Events:**

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Support

For issues or questions:

1. Check Stripe Dashboard for payment/webhook logs
2. Review Supabase logs for database errors
3. Check browser console for frontend errors
4. Review server logs for API errors
