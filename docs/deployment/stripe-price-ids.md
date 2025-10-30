# Stripe Price IDs Reference

This document contains all Stripe price IDs for both test and production environments.

## Test Mode Price IDs

All prices are configured in test mode. These should be used for local development and testing.

### Subscription Products

#### Basic Tier
- **Product ID**: `prod_TKP1Qa6MF9RIX9`
- **Monthly Price ID**: `price_1SNkDtRqq8mPUhEry3BHJl1K` ($39/month)
- **Annual Price ID**: `price_1SNkDvRqq8mPUhErb1atjbrv` ($349/year)

#### Pro Tier
- **Product ID**: `prod_TKP2zVCiYtDZcY`
- **Monthly Price ID**: `price_1SNkE1Rqq8mPUhErlkNKsMpA` ($59/month)
- **Annual Price ID**: `price_1SNkE2Rqq8mPUhEr22dHvDgC` ($549/year)

#### All-Access Tier
- **Product ID**: `prod_TKP2Bog4uwEo6H`
- **Monthly Price ID**: `price_1SNkE6Rqq8mPUhErJyWYqzQM` ($79/month)
- **Annual Price ID**: `price_1SNkE7Rqq8mPUhErRL63Fu3d` ($749/year)

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
# Subscription Tiers
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=price_1SNkDtRqq8mPUhEry3BHJl1K
NEXT_PUBLIC_STRIPE_BASIC_ANNUAL=price_1SNkDvRqq8mPUhErb1atjbrv
NEXT_PUBLIC_STRIPE_PRO_MONTHLY=price_1SNkE1Rqq8mPUhErlkNKsMpA
NEXT_PUBLIC_STRIPE_PRO_ANNUAL=price_1SNkE2Rqq8mPUhEr22dHvDgC
NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY=price_1SNkE6Rqq8mPUhErJyWYqzQM
NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL=price_1SNkE7Rqq8mPUhErRL63Fu3d

# Exam Packages
NEXT_PUBLIC_STRIPE_EXAM_3MONTH=price_1SNkEERqq8mPUhEr72jPCaPa
NEXT_PUBLIC_STRIPE_EXAM_6MONTH=price_1SNkEFRqq8mPUhErJED2VPKt
NEXT_PUBLIC_STRIPE_EXAM_12MONTH=price_1SNkEFRqq8mPUhErivTNpT1I
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

- **Subscription prices**: Recurring prices (monthly/yearly) used for subscription checkout sessions
- **One-time prices**: Fixed prices used for payment checkout sessions (exam packages)

## Notes

- All subscription prices are recurring (`type: "recurring"`)
- All exam package prices are one-time (`type: "one_time"`)
- Prices cannot be deleted once used, only archived (`active: false`)
- To change pricing, create a new price and archive the old one
