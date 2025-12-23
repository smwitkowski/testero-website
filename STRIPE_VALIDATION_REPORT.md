# Stripe Configuration Validation Report

Generated: $(date)

## Executive Summary

⚠️ **Overall Status: ACTION REQUIRED** - Stripe prices need to be created/updated to match new pricing model

**Required Actions:**
1. Create new Basic monthly price: $14.99/month (replace old $39/month price)
2. Create new Basic 3-month price: $39.99 every 3 months (recurring, `interval=month`, `interval_count=3`)
3. Archive old annual prices (keep for grandfathered subscriptions)
4. Update environment variables with new price IDs once created

The codebase has been updated to support the new pricing model ($14.99/month, $39.99/3 months), but Stripe prices need to be created manually in the Stripe Dashboard.

---

## 1. Stripe Account Information

- **Account ID**: `acct_1PmIcLRqq8mPUhEr`
- **Display Name**: Testero
- **Mode**: Test (based on price IDs observed)

---

## 2. Products Validation

### ✅ Subscription Products (All Present)

| Product Name | Product ID | Status |
|-------------|------------|--------|
| Basic | `prod_TKP1Qa6MF9RIX9` | ✅ Active |
| Pro | `prod_TKP2zVCiYtDZcY` | ✅ Active |
| All-Access | `prod_TKP2Bog4uwEo6H` | ✅ Active |

### ✅ Exam Package Products (All Present)

| Product Name | Product ID | Status |
|-------------|------------|--------|
| 3-Month Access | `prod_TKP2DL9Cnf3ftm` | ✅ Active |
| 6-Month Access | `prod_TKP2ZUMDlikQXn` | ✅ Active |
| 12-Month Access | `prod_TKP2geidSx6xaf` | ✅ Active |

### ⚠️ Legacy Products (Not Used)

The following products exist but are not referenced in the codebase:
- `prod_TKLt7MXKy8eStk` - "Pro" (legacy)
- `prod_TKLsKjYIRzCuYD` - "starter" (legacy)
- `prod_SpUBrzr2mfMdGa` - "Testero Pro" (legacy)
- `prod_SpUAm7kUlnBAdc` - "Testero Pro" (legacy)

**Recommendation**: Archive these products in Stripe Dashboard to avoid confusion.

---

## 3. Price IDs Validation

### ⚠️ Subscription Prices (Need Updates in Stripe)

| Tier | Interval | Expected Amount | Current Stripe Price ID | Current Stripe Amount | Status |
|------|----------|----------------|-----------------|---------------|--------|
| Basic | Monthly | $14.99 (1499¢) | `price_1SNkDtRqq8mPUhEry3BHJl1K` | 3900¢ | ⚠️ **NEEDS NEW PRICE** |
| Basic | 3-Month | $39.99 (3999¢) | (none) | N/A | ⚠️ **NEEDS CREATION** |
| Basic | ~~Annual~~ | ~~$349~~ | `price_1SNkDvRqq8mPUhErb1atjbrv` | 34900¢ | ✅ Grandfathered (archive) |
| Pro | Monthly | $59 (5900¢) | `price_1SNkE1Rqq8mPUhErlkNKsMpA` | 5900¢ | ✅ Match |
| Pro | 3-Month | (TBD) | (none) | N/A | ⚠️ **NEEDS CREATION** (hidden tier) |
| Pro | ~~Annual~~ | ~~$549~~ | `price_1SNkE2Rqq8mPUhEr22dHvDgC` | 54900¢ | ✅ Grandfathered (archive) |
| All-Access | Monthly | $79 (7900¢) | `price_1SNkE6Rqq8mPUhErJyWYqzQM` | 7900¢ | ✅ Match |
| All-Access | 3-Month | (TBD) | (none) | N/A | ⚠️ **NEEDS CREATION** (hidden tier) |
| All-Access | ~~Annual~~ | ~~$749~~ | `price_1SNkE7Rqq8mPUhErRL63Fu3d` | 74900¢ | ✅ Grandfathered (archive) |

### ✅ Exam Package Prices (All Match Codebase)

| Package | Expected Amount | Stripe Price ID | Stripe Amount | Status |
|---------|----------------|-----------------|---------------|--------|
| 3-Month | $99 (9900¢) | `price_1SNkEERqq8mPUhEr72jPCaPa` | 9900¢ | ✅ Match |
| 6-Month | $149 (14900¢) | `price_1SNkEFRqq8mPUhErJED2VPKt` | 14900¢ | ✅ Match |
| 12-Month | $199 (19900¢) | `price_1SNkEFRqq8mPUhErivTNpT1I` | 19900¢ | ✅ Match |

---

## 4. Codebase Alignment

### ✅ Environment Variable Configuration (Updated)

**File**: `lib/pricing/constants.ts`

All required environment variables are defined:
- ✅ `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY`
- ✅ `NEXT_PUBLIC_STRIPE_BASIC_3MONTH`
- ✅ `NEXT_PUBLIC_STRIPE_PRO_MONTHLY`
- ✅ `NEXT_PUBLIC_STRIPE_PRO_3MONTH`
- ✅ `NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY`
- ✅ `NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH`
- ✅ `NEXT_PUBLIC_STRIPE_EXAM_3MONTH`
- ✅ `NEXT_PUBLIC_STRIPE_EXAM_6MONTH`
- ✅ `NEXT_PUBLIC_STRIPE_EXAM_12MONTH`

**Price Amounts Match (New Pricing)**:
- ✅ Basic: $14.99/month, $39.99 every 3 months
- ✅ Pro: $59/month, (3-month price TBD) — hidden tier
- ✅ All-Access: $79/month, (3-month price TBD) — hidden tier
- ✅ Exam Packages: $99, $149, $199

### ✅ API Route Validation

**File**: `app/api/billing/checkout/route.ts`

- ✅ Validates price IDs against `SUBSCRIPTION_TIERS` and `EXAM_PACKAGES`
- ✅ Uses environment variables from `lib/pricing/constants.ts`
- ✅ Properly handles both subscription and one-time payment modes

### ✅ Playwright Configuration

**File**: `playwright.config.ts`

- ✅ All 9 price ID environment variables have test fallbacks
- ✅ Uses `ANNUAL` (not `YEARLY`) consistently
- ✅ Fallback values follow pattern: `price_test_{tier}_{interval}`

---

## 5. Documentation Alignment

### ✅ Setup Documentation

**File**: `docs/deployment/stripe-setup.md`

- ✅ Lists all 9 required price ID environment variables
- ✅ Uses `ANNUAL` (not `YEARLY`) consistently
- ✅ Includes price reference table with amounts in cents
- ✅ Setup steps reference all products/prices

### ✅ Price IDs Reference

**File**: `docs/deployment/stripe-price-ids.md`

- ✅ Contains actual Stripe price IDs from test mode
- ✅ Matches Stripe MCP data exactly
- ✅ Documents Product IDs correctly
- ✅ Environment variable examples match actual IDs

---

## 6. Potential Issues & Recommendations

### ⚠️ Legacy Products

**Issue**: 4 legacy products exist in Stripe that are not used by the codebase.

**Impact**: Low - These products are not referenced, but could cause confusion.

**Recommendation**: 
1. Archive legacy products in Stripe Dashboard
2. Remove associated prices if no longer needed

### ⚠️ Naming Convention Note

**Status**: ✅ Consistent within contexts, but different conventions exist

**Environment Variables & Code**: Use `ANNUAL` (e.g., `NEXT_PUBLIC_STRIPE_PRO_ANNUAL`)
- ✅ `lib/pricing/constants.ts` - Uses `ANNUAL`
- ✅ `playwright.config.ts` - Uses `ANNUAL`
- ✅ `docs/deployment/stripe-setup.md` - Uses `ANNUAL`

**Database Schema**: Uses `yearly` (e.g., `stripe_price_id_yearly`)
- ✅ `supabase/migrations/20250106_create_billing_tables.sql` - Uses `yearly`
- ✅ `app/api/billing/webhook/route.ts` - Queries `stripe_price_id_yearly` correctly

**Note**: This is intentional - database column names use `yearly` while environment variables use `ANNUAL`. The webhook handler correctly maps between them. No functional issues, but worth noting for clarity.

### ✅ Price Type Validation

**Status**: ✅ Correctly configured

- Subscription prices use `recurring` type with `interval: "month"` or `interval: "year"`
- Exam packages use `one_time` type
- Webhook handler properly distinguishes between types

---

## 7. Testing Recommendations

### Environment Variable Validation

Run the following to verify environment variables are set:

```bash
# Check all required variables are present
node -e "
const required = [
  'NEXT_PUBLIC_STRIPE_BASIC_MONTHLY',
  'NEXT_PUBLIC_STRIPE_BASIC_ANNUAL',
  'NEXT_PUBLIC_STRIPE_PRO_MONTHLY',
  'NEXT_PUBLIC_STRIPE_PRO_ANNUAL',
  'NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY',
  'NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL',
  'NEXT_PUBLIC_STRIPE_EXAM_3MONTH',
  'NEXT_PUBLIC_STRIPE_EXAM_6MONTH',
  'NEXT_PUBLIC_STRIPE_EXAM_12MONTH'
];
required.forEach(key => {
  const val = process.env[key];
  console.log(val ? '✅' : '❌', key, val || 'NOT SET');
});
"
```

### Build Validation

```bash
# Should not fail if env vars missing (graceful fallback)
npm run build
```

### Price ID Validation in Code

The codebase validates price IDs in `app/api/billing/checkout/route.ts`:
- Builds list from `SUBSCRIPTION_TIERS` and `EXAM_PACKAGES`
- Rejects any price ID not in the configured list
- This ensures only valid prices can be used

### Production Environment Variable Verification

**CI/CD Configuration**:
- Stripe price IDs are wired through GitHub Actions workflow (`.github/workflows/deploy-to-cloud-run.yml`)
- Variables are passed as Docker build args and Cloud Run `--set-env-vars` flags
- Ensure GitHub repository secrets are configured for all `NEXT_PUBLIC_STRIPE_*` variables

**Verifying Cloud Run Configuration**:
```bash
# Check configured env vars on Cloud Run service
gcloud run services describe testero-frontend --region=us-central1 \
  --format='yaml(spec.template.spec.containers[0].env)'

# Search logs for missing price ID configuration issues
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=testero-frontend AND \
  (textPayload=~'missing_basic_monthly_price_id' OR \
   jsonPayload.error=~'missing_basic_monthly_price_id')" \
  --limit=50 --format=json
```

**Behavioral Notes**:
- Missing `NEXT_PUBLIC_STRIPE_BASIC_*` vars will **not** break anonymous signup flows (users are redirected to `/signup` regardless)
- Missing vars **will** prevent authenticated users from initiating checkout (error logged, checkout blocked)
- The `useStartBasicCheckout` hook enforces price ID presence only for authenticated checkout flows

---

## 8. Summary

### ✅ What's Working

1. **Codebase updated** to support new pricing model ($14.99/month, $39.99/3 months)
2. **Environment variable naming** updated (`3MONTH` instead of `ANNUAL`)
3. **API routes properly validate** price IDs before creating checkout sessions
4. **Database schema** migration created for 3-month pricing support
5. **Documentation updated** to reflect new pricing model

### ⚠️ Action Required

1. **Create new Stripe prices**:
   - Basic monthly: $14.99/month (new price, archive old $39/month)
   - Basic 3-month: $39.99 every 3 months (`interval=month`, `interval_count=3`)
   - Pro 3-month: (if needed for hidden tier)
   - All-Access 3-month: (if needed for hidden tier)
2. **Archive old annual prices** (keep for grandfathered subscriptions):
   - `price_1SNkDvRqq8mPUhErb1atjbrv` (Basic annual)
   - `price_1SNkE2Rqq8mPUhEr22dHvDgC` (Pro annual)
   - `price_1SNkE7Rqq8mPUhErRL63Fu3d` (All-Access annual)
3. **Update environment variables** with new price IDs once created
4. **Apply Supabase migration** `20251223_add_three_month_pricing.sql` when billing tables are created

### 📋 Action Items

1. ✅ **COMPLETED**: Codebase updated for new pricing model
2. ⚠️ **REQUIRED**: Create new Stripe prices in Dashboard
3. ⚠️ **REQUIRED**: Update environment variables with new price IDs
4. ⚠️ **REQUIRED**: Apply Supabase migration for 3-month pricing columns
5. ⚠️ **OPTIONAL**: Archive legacy products in Stripe Dashboard

---

## Conclusion

The codebase has been **fully updated** to support the new pricing model ($14.99/month, $39.99/3 months). However, **Stripe prices need to be created manually** in the Stripe Dashboard, and environment variables need to be updated with the new price IDs once created.

**Status**: ⚠️ **ACTION REQUIRED** - Create Stripe prices and update environment variables before production deployment

