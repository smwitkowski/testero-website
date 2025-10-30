# Stripe Webhook Configuration Guide

## Overview

This guide provides precise, step-by-step instructions for configuring Stripe webhooks for both **test** and **production** environments. Webhooks enable Stripe to notify your application about payment events in real-time.

## Prerequisites

- Stripe account with API access
- Your application deployed and accessible via HTTPS (for production)
- Local development environment with Stripe CLI installed (for testing)

## Part 1: Test Environment Setup

### Step 1: Access Stripe Dashboard (Test Mode)

1. Navigate to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Ensure you're in **Test mode** (toggle in top-right corner should show "Test mode")
3. If not in test mode, click the toggle to switch

### Step 2: Create Webhook Endpoint

1. In the left sidebar, click **Developers** → **Webhooks**
2. Click the **"+ Add endpoint"** button (top-right)
3. In the **"Endpoint URL"** field, enter one of the following:

   **For Local Development:**
   ```
   http://localhost:3000/api/billing/webhook
   ```
   > Note: For local testing, you'll need to use Stripe CLI to forward webhooks (see Part 3)

   **For Staging/Development Server:**
   ```
   https://your-staging-domain.com/api/billing/webhook
   ```
   > Replace `your-staging-domain.com` with your actual staging domain

4. Click **"Add endpoint"**

### Step 3: Select Events to Subscribe

In the **"Select events to listen to"** section, you need to subscribe to the following events:

#### Required Events for Subscriptions:

- ✅ `checkout.session.completed` - Triggers when subscription or one-time payment completes (handles both `subscription` and `payment` modes)
- ✅ `customer.subscription.created` - Triggers when a new subscription is created (optional but recommended)
- ✅ `customer.subscription.updated` - Triggers when subscription changes (plan, status, etc.)
- ✅ `customer.subscription.deleted` - Triggers when subscription is cancelled
- ✅ `invoice.paid` (or `invoice.payment_succeeded` depending on your Stripe account) - Triggers when subscription renewal payment succeeds
- ✅ `invoice.payment_failed` - Triggers when subscription payment fails

#### Required Events for One-Time Payments:

- ✅ `checkout.session.completed` - **Handles one-time payments** when `mode=payment` (no separate event needed)

**Note:** Since all payments go through Stripe Checkout Sessions, `payment_intent.*` events are **NOT required**. The `checkout.session.completed` event handles both subscription and one-time payments.

#### Quick Selection Method:

Instead of selecting individual events, you can:

1. Click **"Select events"** dropdown
2. Choose **"Select all events"** option (recommended for development)
3. Or manually check each event listed above

### Step 4: Save the Webhook Endpoint

1. Scroll down and click **"Add endpoint"**
2. Your webhook endpoint is now created

### Step 5: Get Webhook Signing Secret

1. After creating the endpoint, you'll see the webhook details page
2. Find the **"Signing secret"** section
3. Click the **"Reveal"** button next to the signing secret
4. Copy the secret (it starts with `whsec_`)
5. **Important:** Save this secret securely - you'll need it for environment variables

### Step 6: Configure Environment Variables

Add the webhook secret to your `.env.local` file:

```bash
# Test Environment Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_your_test_webhook_secret_here
```

> **Security Note:** Never commit `.env.local` to version control. Add it to `.gitignore`.

## Part 2: Production Environment Setup

### Step 1: Switch to Production Mode

1. In Stripe Dashboard, click the **"Test mode"** toggle in the top-right
2. Switch to **"Live mode"**
3. You'll see a confirmation dialog - click **"Switch to live mode"**

### Step 2: Create Production Webhook Endpoint

1. Navigate to **Developers** → **Webhooks**
2. Click **"+ Add endpoint"**
3. Enter your production endpoint URL:

```
https://your-production-domain.com/api/billing/webhook
```

> Replace `your-production-domain.com` with your actual production domain

### Step 3: Select Events for Production

**Important:** Subscribe to the **same events** as test environment:

- ✅ `checkout.session.completed` - Handles both subscription and one-time payments
- ✅ `customer.subscription.created` - Optional but recommended
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.paid` (or `invoice.payment_succeeded` depending on your account)
- ✅ `invoice.payment_failed`

**Note:** `payment_intent.*` events are NOT required since all payments use Stripe Checkout.

### Step 4: Get Production Signing Secret

1. After creating the endpoint, reveal the signing secret
2. Copy the production secret (also starts with `whsec_`)

### Step 5: Configure Production Environment Variables

**For Cloud Run / Docker Deployment:**

Add to your production environment variables:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret_here
```

**For GitHub Actions / CI/CD:**

Add to GitHub Secrets:
1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `STRIPE_WEBHOOK_SECRET`
4. Value: Your production webhook secret (`whsec_...`)
5. Click **"Add secret"**

**For Google Cloud Platform:**

```bash
# Using gcloud CLI
gcloud run services update your-service-name \
  --update-env-vars STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Or via Google Cloud Console:
# Cloud Run → Select service → Edit & Deploy New Revision → 
# Variables & Secrets → Add Variable → STRIPE_WEBHOOK_SECRET
```

## Part 3: Local Development Testing with Stripe CLI

### Step 1: Install Stripe CLI

**macOS (Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download latest release from https://github.com/stripe/stripe-cli/releases
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows:**
```bash
# Using Scoop
scoop install stripe

# Or download from https://github.com/stripe/stripe-cli/releases
```

### Step 2: Authenticate Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate with Stripe.

### Step 3: Forward Webhooks to Local Server

In a terminal window, run:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_... (^C to quit)
```

### Step 4: Copy the CLI Webhook Secret

The Stripe CLI generates a **temporary webhook secret** for local testing. Copy this secret and add it to `.env.local`:

```bash
# Use the CLI-generated secret for local development
STRIPE_WEBHOOK_SECRET=whsec_cli_generated_secret_here
```

### Step 5: Trigger Test Events

In a **new terminal window**, trigger test events:

```bash
# Test subscription checkout completion
stripe trigger checkout.session.completed --override checkout_session:mode=subscription

# Test one-time payment checkout completion
stripe trigger checkout.session.completed --override checkout_session:mode=payment

# Test subscription creation
stripe trigger customer.subscription.created

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription cancellation
stripe trigger customer.subscription.deleted

# Test successful invoice payment
stripe trigger invoice.payment_succeeded

# Test failed invoice payment
stripe trigger invoice.payment_failed

# Test successful one-time payment
stripe trigger payment_intent.succeeded

# Test failed one-time payment
stripe trigger payment_intent.payment_failed
```

### Step 6: Verify Webhook Reception

Check your application logs to confirm webhooks are being received:

```bash
# In your Next.js dev server terminal, you should see:
# "Webhook received: checkout.session.completed"
# "Event processed successfully"
```

## Part 4: Verification Checklist

After completing setup, verify each item:

### Test Environment

- [ ] Webhook endpoint created in Stripe Dashboard (test mode)
- [ ] All 8 required events subscribed
- [ ] Webhook signing secret copied (`whsec_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` added to `.env.local`
- [ ] Stripe CLI forwarding working (`stripe listen`)
- [ ] Test events received successfully
- [ ] Webhook signature verification passes
- [ ] Database updates occur correctly

### Production Environment

- [ ] Webhook endpoint created in Stripe Dashboard (live mode)
- [ ] All 8 required events subscribed
- [ ] Production webhook signing secret copied
- [ ] `STRIPE_WEBHOOK_SECRET` added to production environment variables
- [ ] HTTPS endpoint accessible from Stripe
- [ ] Test webhook sent from Stripe Dashboard succeeds
- [ ] Webhook signature verification passes
- [ ] Database updates occur correctly

## Part 5: Testing Webhook Endpoint

### Method 1: Send Test Webhook from Stripe Dashboard

1. Go to **Developers** → **Webhooks** → Select your endpoint
2. Click **"Send test webhook"**
3. Select event type: `checkout.session.completed`
4. Click **"Send test webhook"**
5. Check the **"Recent deliveries"** section for response status

### Method 2: Use Stripe CLI (Recommended)

```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/billing/webhook

# In another terminal, trigger events
stripe trigger checkout.session.completed
```

### Method 3: Manual Testing with Real Checkout

1. Create a test checkout session
2. Complete payment with test card: `4242 4242 4242 4242`
3. Check webhook logs in Stripe Dashboard
4. Verify database updates in your application

## Part 6: Webhook Endpoint Configuration Details

### Endpoint URL Format

The webhook endpoint must follow this exact format:

```
https://your-domain.com/api/billing/webhook
```

**Important Requirements:**
- Must use HTTPS (HTTP only for localhost)
- Must be publicly accessible (Stripe can't reach private IPs)
- Must respond within 30 seconds
- Must return HTTP 200 for successful processing

### Event Selection Best Practices

**Recommended:** Select all events during development to catch any unexpected events.

**Production:** Select only required events to reduce unnecessary processing:

**Required Events:**
- `checkout.session.completed` - Handles both subscription and one-time payments
- `customer.subscription.created` - Optional but recommended
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid` (or `invoice.payment_succeeded` depending on your account)
- `invoice.payment_failed`

**Note:** `payment_intent.*` events are NOT required since all payments use Stripe Checkout Sessions.

### Webhook Signing Secret Format

Webhook secrets follow this format:

```
whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Test Mode Secret:** Starts with `whsec_test_...` or `whsec_...` (longer)
**Production Secret:** Starts with `whsec_live_...` or `whsec_...` (longer)
**CLI Secret:** Starts with `whsec_cli_...` (temporary, changes per session)

## Part 7: Troubleshooting

### Issue: "Webhook signature verification failed"

**Symptoms:**
- Webhook handler returns 400 status
- Error log shows "Invalid webhook signature"

**Solutions:**

1. **Verify Environment Variable:**
   ```bash
   # Check if secret is set correctly
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. **Check Secret Match:**
   - Ensure secret matches the one from Stripe Dashboard
   - For local testing, use CLI-generated secret
   - For production, use production endpoint secret

3. **Verify Raw Body:**
   - Ensure webhook handler receives raw body (not parsed JSON)
   - Check Next.js middleware isn't modifying request body

4. **Check Request Modification:**
   - Ensure proxy/load balancer isn't modifying headers
   - Verify `stripe-signature` header is present

### Issue: "Webhook endpoint not reachable"

**Symptoms:**
- Stripe Dashboard shows webhook delivery failures
- Error: "Connection refused" or "Timeout"

**Solutions:**

1. **Verify HTTPS:**
   - Production endpoints must use HTTPS
   - Check SSL certificate is valid

2. **Check Firewall:**
   - Ensure Stripe IPs are whitelisted (if using firewall)
   - Stripe uses IP ranges: Check [Stripe IPs](https://stripe.com/docs/ips)

3. **Verify Public Access:**
   - Endpoint must be publicly accessible
   - Test with: `curl https://your-domain.com/api/billing/webhook`

4. **Check Cloud Run Configuration:**
   - Ensure service allows unauthenticated requests (for webhooks)
   - Verify ingress settings allow external traffic

### Issue: "Event already processed" (but shouldn't be)

**Symptoms:**
- Webhook returns 200 but no database update
- Idempotency check preventing processing

**Solutions:**

1. **Check `webhook_events` Table:**
   ```sql
   SELECT * FROM webhook_events 
   WHERE stripe_event_id = 'evt_...' 
   ORDER BY created_at DESC;
   ```

2. **Reset Processing Status (if needed):**
   ```sql
   UPDATE webhook_events 
   SET processed = false 
   WHERE stripe_event_id = 'evt_...';
   ```

3. **Verify Event ID:**
   - Ensure event ID is unique
   - Check for duplicate webhook deliveries

### Issue: "Missing user_id in session metadata"

**Symptoms:**
- Webhook processing fails
- Error: "Missing user_id in session metadata"

**Solutions:**

1. **Verify Checkout Session Creation:**
   - Ensure `user_id` is included in metadata when creating checkout session
   - Check `createCheckoutSession` includes metadata

2. **Check Stripe Dashboard:**
   - View checkout session details
   - Verify metadata contains `user_id`

## Part 8: Security Best Practices

### 1. Webhook Signature Verification

**Always verify webhook signatures** before processing events. The webhook handler should:

```typescript
const signature = request.headers.get("stripe-signature");
if (!signature) {
  return NextResponse.json({ error: "Missing signature" }, { status: 400 });
}

// Verify signature
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

### 2. Environment Variable Security

- Never commit webhook secrets to version control
- Use different secrets for test and production
- Rotate secrets periodically (annually recommended)
- Store secrets in secure secret management systems

### 3. Idempotency

- Always check for duplicate events using `webhook_events` table
- Use Stripe event IDs for idempotency keys
- Ensure webhook processing is idempotent

### 4. Error Handling

- Log all webhook processing errors
- Return appropriate HTTP status codes
- Don't expose internal errors to Stripe

### 5. Rate Limiting

- Consider rate limiting webhook endpoints
- Monitor webhook delivery frequency
- Set up alerts for unusual patterns

## Part 9: Monitoring Webhook Health

### Stripe Dashboard Monitoring

1. Go to **Developers** → **Webhooks** → Select endpoint
2. Check **"Recent deliveries"** section:
   - ✅ Green = Success (200 response)
   - ❌ Red = Failure (non-200 response)
   - ⏱️ Yellow = Retrying

### Application Logging

Monitor your application logs for:

```typescript
// Success logs
console.log(`Webhook received: ${event.type}`);
console.log(`Event processed: ${event.id}`);

// Error logs
console.error(`Webhook error: ${error.message}`);
console.error(`Failed event: ${event.id}`);
```

### Database Monitoring

Query `webhook_events` table:

```sql
-- Check processing status
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false) as pending,
  COUNT(*) FILTER (WHERE error IS NOT NULL) as errors
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type;
```

## Part 10: Updating Webhook Configuration

### Changing Events

1. Go to webhook endpoint settings
2. Click **"Edit"**
3. Add/remove events from the list
4. Click **"Save changes"**

### Changing Endpoint URL

1. Create new endpoint with new URL
2. Copy new signing secret
3. Update environment variables
4. Test new endpoint
5. Delete old endpoint after verification

### Rotating Webhook Secret

1. Go to webhook endpoint settings
2. Click **"Reveal"** or **"Reset"** signing secret
3. Copy new secret
4. Update environment variables
5. Restart application
6. Test webhook reception

## Summary

After completing this guide, you should have:

- ✅ Test webhook endpoint configured in Stripe Dashboard
- ✅ Production webhook endpoint configured in Stripe Dashboard
- ✅ All required events subscribed
- ✅ Webhook secrets configured in environment variables
- ✅ Local testing setup with Stripe CLI
- ✅ Webhook verification working correctly

## Next Steps

1. Verify webhook handler code processes all events correctly
2. Test each event type with Stripe CLI
3. Monitor webhook deliveries in Stripe Dashboard
4. Set up alerts for webhook failures
5. Document webhook event processing in your application

## Additional Resources

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Webhook Security Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)

## Support

If you encounter issues:

1. Check Stripe Dashboard → Webhooks → Recent deliveries for error details
2. Review application logs for webhook processing errors
3. Verify environment variables are set correctly
4. Test with Stripe CLI to isolate issues
5. Contact Stripe Support for webhook delivery issues

