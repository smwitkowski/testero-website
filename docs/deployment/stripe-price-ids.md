# Stripe Price IDs Reference

This document contains all Stripe price IDs for both test and production environments.

## Test Mode Price IDs

All prices are configured in test mode. These should be used for local development and testing.

### Subscription Products

#### Basic Tier
- **Product ID (Live)**: `prod_TKP1Qa6MF9RIX9`
- **Product ID (Test)**: `prod_TetkATYZ4BRZ3n` (created automatically by script)
- **Monthly Price ID (Live)**: `price_1ShaMIRqq8mPUhErRe7fmto1` ($14.99/month) ✅ Production
- **3-Month Price ID (Live)**: `price_1ShaMSRqq8mPUhEriBMr1ouz` ($39.99/3 months) ✅ Production
- **Monthly Price ID (Test)**: `price_1ShZxNRqq8mPUhErGyPcvMbo` ($14.99/month) ✅ Test Mode
- **3-Month Price ID (Test)**: `price_1ShZxORqq8mPUhErscmJspF8` ($39.99/3 months) ✅ Test Mode
- **Legacy Monthly (Archive)**: `price_1SNkDtRqq8mPUhEry3BHJl1K` ($39/month) — archive in Stripe Dashboard
- **Legacy Annual (Archive)**: `price_1SNkDvRqq8mPUhErb1atjbrv` ($349/year) — archive for grandfathered subscriptions

#### Pro Tier
- **Product ID**: `prod_TKP2zVCiYtDZcY`
- **Monthly Price ID**: `price_1SNkE1Rqq8mPUhErlkNKsMpA` ($59/month) — update if changed
- **3-Month Price ID**: `price_pro_3month` — replace with actual new price ID

#### All-Access Tier
- **Product ID**: `prod_TKP2Bog4uwEo6H`
- **Monthly Price ID**: `price_1SNkE6Rqq8mPUhErJyWYqzQM` ($79/month) — update if changed
- **3-Month Price ID**: `price_all_access_3month` — replace with actual new price ID

### One-Time Exam Packages

#### 3-Month Exam Package
- **Product ID**: `prod_TKP2DL9Cnf3ftm`
- **Price ID**: `price_1SNkEERqq8mPUhEr72jPCaPa` ($99 one-time)

#### 6-Month Exam Package
- **Product ID**: `prod_TKP2ZUMDlikQXn`
- **Price ID**: `price_1SNkEFRqq8mPUhErJED2VPKt` ($149 one-time)

#### 12-Month Exam Package
- **Product ID**: `prod_TKP2geidSx6xaf`
- **Price ID**: `price_1SNkEFRqq8mPUhErivTNpT1I` ($199 one-time)

## Production Mode Price IDs

Production price IDs will be added here once products are copied to live mode from the Stripe Dashboard.

**Note**: To copy products from test to live mode:
1. Go to Stripe Dashboard → Products
2. Select each product
3. Click "Copy to live mode" (available once per product)

## Environment Variables

These price IDs should be set in your environment variables:

```bash
# Subscription Tiers (Production - Live Mode)
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=price_1ShaMIRqq8mPUhErRe7fmto1   # $14.99 monthly (live)
NEXT_PUBLIC_STRIPE_BASIC_3MONTH=price_1ShaMSRqq8mPUhEriBMr1ouz    # $39.99 every 3 months (live)

# Subscription Tiers (Test Mode - For Local Development)
# NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=price_1ShZxNRqq8mPUhErGyPcvMbo   # $14.99 monthly (test)
# NEXT_PUBLIC_STRIPE_BASIC_3MONTH=price_1ShZxORqq8mPUhErscmJspF8    # $39.99 every 3 months (test)
NEXT_PUBLIC_STRIPE_PRO_MONTHLY=price_pro_monthly
NEXT_PUBLIC_STRIPE_PRO_3MONTH=price_pro_3month
NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY=price_all_access_monthly
NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH=price_all_access_3month

# Exam Packages
NEXT_PUBLIC_STRIPE_EXAM_3MONTH=price_exam_3month
NEXT_PUBLIC_STRIPE_EXAM_6MONTH=price_exam_6month
NEXT_PUBLIC_STRIPE_EXAM_12MONTH=price_exam_12month
```

## Verification

To verify all prices are active and correct:

```bash
# Using Stripe CLI
stripe prices list --limit 50

# Or check in Stripe Dashboard
# https://dashboard.stripe.com/test/products
```

## Price Types

- **Subscription prices**: Recurring prices (monthly/3-month) used for subscription checkout sessions
- **One-time prices**: Fixed prices used for payment checkout sessions (exam packages)

## Notes

- All subscription prices are recurring (`type: "recurring"`)
- All exam package prices are one-time (`type: "one_time"`)
- Prices cannot be deleted once used, only archived (`active: false`)
- To change pricing, create a new price and archive the old one

## ⚠️ Action Required: Create New Stripe Prices

The codebase has been updated to support the new pricing model, but **new Stripe prices must be created manually** in the Stripe Dashboard:

### Steps to Create New Prices

1. **Go to Stripe Dashboard** → Products → Select "Basic" (`prod_TKP1Qa6MF9RIX9`)

2. **Create New Monthly Price** ($14.99/month):
   - Click "Add another price"
   - Amount: $14.99 (1499 cents)
   - Billing period: Recurring
   - Interval: Month
   - Interval count: 1
   - Copy the new price ID and update `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY` env var
   - **Archive** the old monthly price (`price_1SNkDtRqq8mPUhEry3BHJl1K`) to prevent new subscriptions

3. **Create New 3-Month Price** ($39.99 every 3 months):
   - Click "Add another price"
   - Amount: $39.99 (3999 cents)
   - Billing period: Recurring
   - Interval: Month
   - Interval count: **3** (important: this makes it renew every 3 months)
   - Copy the new price ID and update `NEXT_PUBLIC_STRIPE_BASIC_3MONTH` env var

4. **Archive Old Annual Price** (keep for grandfathered subscriptions):
   - Find `price_1SNkDvRqq8mPUhErb1atjbrv` (Basic annual $349/year)
   - Click "Archive" (don't delete - existing subscribers need it)
   - Repeat for Pro and All-Access annual prices if needed

5. **Update Environment Variables**:
   - Add new price IDs to `.env.local` for local development
   - Add to GitHub Secrets for CI/CD
   - Add to Cloud Run environment variables for production

### Verification

After creating prices, verify they work:
```bash
# Test checkout with new monthly price
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId": "YOUR_NEW_MONTHLY_PRICE_ID", "mode": "subscription"}'

# Test checkout with new 3-month price
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId": "YOUR_NEW_3MONTH_PRICE_ID", "mode": "subscription"}'
```
