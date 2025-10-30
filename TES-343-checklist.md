# TES-343: Webhook Configuration Checklist

## ✅ Code Implementation Complete

All code changes have been implemented:
- Webhook handlers for recurring subscription renewals (`invoice.paid` / `invoice.payment_succeeded`)
- One-time payment handling in `checkout.session.completed`
- Optional `customer.subscription.created` handler
- Comprehensive unit tests
- Documentation updates

## 🔧 Manual Steps Required

### 1. Local Environment Setup

Add to your `.env.local` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_rC8KVvYLpFapL2YpqHz8xHai9mKHweTf
```

### 2. Stripe Dashboard Configuration

#### Test Mode Webhook Endpoint:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Click "+ Add endpoint"
3. Endpoint URL: `http://localhost:3000/api/billing/webhook` (or your staging URL)
4. Select events:
   - ✅ `checkout.session.completed` - Handles both subscription and one-time payments
   - ✅ `customer.subscription.created` - Optional but recommended
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid` (or `invoice.payment_succeeded` depending on your account)
   - ✅ `invoice.payment_failed`
   - ❌ `payment_intent.succeeded` - **NOT REQUIRED** (all payments via Checkout)
   - ❌ `payment_intent.payment_failed` - **NOT REQUIRED** (all payments via Checkout)
5. Copy signing secret: `whsec_rC8KVvYLpFapL2YpqHz8xHai9mKHweTf` ✅ (already provided)

#### Production Mode Webhook Endpoint:
1. Switch to Live mode in Stripe Dashboard
2. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
3. Click "+ Add endpoint"
4. Endpoint URL: `https://your-production-domain.com/api/billing/webhook`
5. Select the same 6 events listed above (excluding payment_intent.*)
6. Copy signing secret: `whsec_4ThMZl77FsOsXmBMEGuV22g05xWefHQW` ✅ (already provided)

### 3. Production Environment Variables

Set in your deployment platform (Cloud Run/GCP or CI/CD):
```bash
STRIPE_WEBHOOK_SECRET=whsec_4ThMZl77FsOsXmBMEGuV22g05xWefHQW
```

**For Google Cloud Run:**
```bash
gcloud run services update your-service-name \
  --update-env-vars STRIPE_WEBHOOK_SECRET=whsec_4ThMZl77FsOsXmBMEGuV22g05xWefHQW
```

**For GitHub Actions:**
1. Go to repository → Settings → Secrets and variables → Actions
2. Add repository secret: `STRIPE_WEBHOOK_SECRET` = `whsec_4ThMZl77FsOsXmBMEGuV22g05xWefHQW`

### 4. Local Testing with Stripe CLI

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://github.com/stripe/stripe-cli/releases

# Authenticate
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# In another terminal, trigger test events:
stripe trigger checkout.session.completed
stripe trigger invoice.paid               # or: invoice.payment_succeeded
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### 5. Validation Steps

#### Test Environment:
- [ ] Webhook endpoint created in Stripe Dashboard (test mode)
- [ ] 6 required events subscribed (checkout.session.completed, customer.subscription.*, invoice.*)
- [ ] Local `.env.local` has test webhook secret
- [ ] Stripe CLI forwarding works
- [ ] Test events received successfully
- [ ] Database updates occur correctly
- [ ] **One-time Checkout flow creates `payment_history` entry** (mode=payment)

#### Production Environment:
- [ ] Webhook endpoint created in Stripe Dashboard (live mode)
- [ ] 6 required events subscribed
- [ ] Production environment variable set
- [ ] HTTPS endpoint accessible from Stripe
- [ ] Test webhook sent from Stripe Dashboard succeeds
- [ ] Webhook signature verification passes
- [ ] Database updates occur correctly
- [ ] **One-time payment `payment_history` entries verified**

## 📚 Documentation

Full details available in:
- `docs/deployment/stripe-webhook-setup.md` - Complete setup guide
- `docs/deployment/stripe-setup.md` - Quick reference with webhook link

## 🧪 Testing

Run tests:
```bash
# Unit tests
npm test -- __tests__/api/billing/webhook.test.ts

# Integration tests
npm test -- __tests__/integration/billing-flow.test.ts
```

