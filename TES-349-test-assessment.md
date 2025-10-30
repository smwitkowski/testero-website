# TES-349: Test Coverage Assessment Report

**Date:** 2025-10-30  
**Issue:** TES-349 - Add comprehensive test coverage for Stripe billing flows  
**Status:** Assessment Complete - Issues Identified

## Executive Summary

Ran all existing billing test suites and identified **3 critical issues** preventing full test execution:

1. **Jest ESM Parsing Error** - Blocks 2 test files from running
2. **Webhook Test Failures** - 2 tests failing due to mock/expectation mismatches
3. **Missing E2E Tests** - No end-to-end billing flow tests exist

## Test Execution Results

### Test Files Found
- ✅ `__tests__/api/billing/checkout.test.ts` - **BLOCKED** (ESM error)
- ✅ `__tests__/api/billing/trial.test.ts` - **BLOCKED** (ESM error)
- ✅ `__tests__/api/billing/webhook.test.ts` - **PARTIAL** (2 failures, 15 passing)
- ✅ `__tests__/billing/database-schema.test.ts` - Not run (out of scope)
- ❌ `e2e/billing-flows.spec.ts` - **MISSING** (needs creation)

### Current Test Status

```
Test Suites: 3 failed, 3 total
Tests:       2 failed, 15 passed, 17 total
Time:        1.388 s
```

**Passing Tests (15):**
- ✅ Webhook signature verification (3 tests)
- ✅ Idempotency checks (3 tests) 
- ✅ checkout.session.completed events (4 tests)
- ✅ payment_intent.succeeded events (2 tests)
- ✅ customer.subscription.updated (1 test)
- ✅ customer.subscription.deleted (1 test)
- ✅ Error handling (1 test)

**Failing Tests (2):**
- ❌ "should prevent duplicate payment_history records" - Response message missing
- ❌ "should log payment failure" - Expects `insert` but code uses `upsert`

## Critical Issues

### Issue 1: Jest ESM Parsing Error (BLOCKING)

**Affected Files:**
- `__tests__/api/billing/checkout.test.ts`
- `__tests__/api/billing/trial.test.ts`

**Error:**
```
SyntaxError: Unexpected token 'export'
at /node_modules/uncrypto/dist/crypto.web.mjs:15
```

**Root Cause:**
- `@upstash/redis` uses ESM modules that Jest cannot parse
- Tests mock `@/lib/auth/rate-limiter` but Jest still parses the actual file during import
- `lib/auth/rate-limiter.ts` imports `@upstash/redis` at the top level

**Impact:** 
- **0% coverage** for checkout API tests
- **0% coverage** for trial API tests
- Blocks assessment of existing test quality

**Solution Required:**
1. Create manual mock at `__tests__/__mocks__/@/lib/auth/rate-limiter.ts`
2. OR update Jest config to transform `@upstash/redis` modules
3. Mock should export `checkRateLimit` function returning `true` by default

### Issue 2: Webhook Test - Duplicate Payment History

**Test:** `should prevent duplicate payment_history records`  
**File:** `__tests__/api/billing/webhook.test.ts:689`

**Failure:**
```javascript
expect(responseData2.message).toContain("already processed");
// Received: undefined
```

**Root Cause:**
- Test expects `{ message: "Event already processed" }` response
- Webhook route DOES return this message (line 66 of route.ts)
- Mock setup returns `{ processed: true }` for duplicate check but response parsing fails
- Need to verify mock setup matches actual code behavior

**Expected Behavior:**
```typescript
// Line 65-66 of app/api/billing/webhook/route.ts
if (existingEvent?.processed) {
  return NextResponse.json({ message: "Event already processed" }, { status: 200 });
}
```

**Solution Required:**
- Fix mock setup to properly return processed event
- Ensure response parsing matches NextResponse.json structure

### Issue 3: Webhook Test - Payment Failure Logging

**Test:** `should log payment failure`  
**File:** `__tests__/api/billing/webhook.test.ts:897`

**Failure:**
```javascript
expect(mockSupabase.insert).toHaveBeenNthCalledWith(2, ...)
// Expected 2 calls, received 1
```

**Root Cause:**
- Test expects `insert` to be called twice
- Code uses `upsert` for payment_history (line 605 of route.ts)
- First `insert` call is for `webhook_events` table (line 71)
- Second operation should be `upsert` not `insert`

**Expected Behavior:**
```typescript
// Line 605 of app/api/billing/webhook/route.ts
await supabase.from("payment_history").upsert(...)
```

**Solution Required:**
- Change test expectation from `insert` to `upsert`
- Verify call count matches actual database operations

## Current Test Coverage Analysis

### Webhook Handler Tests (15/17 passing - 88%)

**Strengths:**
- ✅ Comprehensive event type coverage
- ✅ Signature verification tests
- ✅ Idempotency handling
- ✅ Error scenarios

**Gaps:**
- ❌ Missing tests for invoice.paid event
- ❌ Missing tests for subscription trial period handling
- ❌ Missing tests for metadata validation edge cases

### Checkout API Tests (BLOCKED)

**Cannot assess** - blocked by ESM parsing error

**Expected Coverage** (based on TES-349 requirements):
- Subscription price ID validation (6 tiers)
- Exam package price ID validation (3 packages)
- Invalid price ID rejection
- Mode detection (subscription vs payment)
- Authentication error handling
- Rate limiting

### Trial API Tests (BLOCKED)

**Cannot assess** - blocked by ESM parsing error

**Expected Coverage** (based on TES-349 requirements):
- Default Pro Monthly price
- Explicit price ID parameter
- Duplicate trial prevention
- Trial end date calculation (14 days)
- Subscription status (trialing)
- User metadata flag updates

### E2E Tests (MISSING)

**Status:** File does not exist (`e2e/billing-flows.spec.ts`)

**Required Tests** (per TES-349):
- ❌ Trial start flow
- ❌ Subscription checkout flow
- ❌ Exam package checkout flow
- ❌ Billing page display
- ❌ Portal access

## Recommendations

### Immediate Actions (Priority 1)

1. **Fix Jest ESM Issue** ⚠️ CRITICAL
   - Create `__tests__/__mocks__/@/lib/auth/rate-limiter.ts`
   - Export mock `checkRateLimit` function
   - Allows checkout and trial tests to run

2. **Fix Webhook Test Failures** ⚠️ HIGH
   - Fix duplicate payment_history test mock setup
   - Change payment failure test to expect `upsert` instead of `insert`
   - Ensures existing tests pass before adding new coverage

### Test Coverage Expansion (Priority 2)

3. **Complete Unit Test Coverage**
   - Expand checkout.test.ts per TES-349 requirements
   - Expand trial.test.ts per TES-349 requirements
   - Add missing webhook event type tests

4. **Create E2E Test Suite**
   - Create `e2e/billing-flows.spec.ts`
   - Implement all 5 required E2E flows
   - Use Playwright with API mocking

### Testing Infrastructure (Priority 3)

5. **Mock Stripe Responses**
   - Create/update `__tests__/__mocks__/stripe.ts`
   - Mock Checkout Session creation
   - Mock Subscription creation
   - Mock Payment Intent creation
   - Mock Webhook event construction

6. **Test Data Fixtures**
   - Document valid test price IDs
   - Create mock customer/subscription IDs
   - Standardize test data across suites

## Next Steps

1. ✅ Fix package.json trailing comma (DONE)
2. 🔄 Create rate-limiter mock to fix ESM issue
3. 🔄 Fix 2 failing webhook tests
4. 📋 Create comprehensive test plan based on TES-349 requirements
5. 📋 Implement missing test coverage incrementally

## Test Execution Commands

```bash
# Run billing unit tests (after fixes)
npm test -- __tests__/api/billing/

# Run webhook tests only
npm test -- __tests__/api/billing/webhook.test.ts

# Run with coverage
npm test -- --coverage __tests__/api/billing/

# Run E2E tests (after creation)
npm run e2e -- billing-flows.spec.ts
```

## Files Requiring Updates

### Immediate Fixes
- `__tests__/__mocks__/@/lib/auth/rate-limiter.ts` - **CREATE**
- `__tests__/api/billing/webhook.test.ts` - **FIX** (2 tests)

### Test Coverage Expansion
- `__tests__/api/billing/checkout.test.ts` - **EXPAND**
- `__tests__/api/billing/trial.test.ts` - **EXPAND**
- `__tests__/api/billing/webhook.test.ts` - **ADD** missing event types
- `e2e/billing-flows.spec.ts` - **CREATE**

### Infrastructure
- `__tests__/__mocks__/stripe.ts` - **CREATE/UPDATE**
- `jest.config.ts` - **REVIEW** (may need ESM config updates)

