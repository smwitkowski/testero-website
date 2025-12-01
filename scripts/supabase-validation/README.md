# Supabase Validation Queries

This directory contains SQL queries to validate PostHog dashboard metrics against Supabase database as source of truth.

## Purpose

These queries help:
1. Verify PostHog event tracking accuracy
2. Identify missing events or data quality issues
3. Calculate ground-truth metrics for comparison
4. Debug discrepancies between PostHog and database

## Usage

1. Run query in Supabase SQL Editor
2. Compare results with corresponding PostHog dashboard insight
3. Document any discrepancies >5% in data dictionary
4. Investigate root causes of significant differences

## Validation Queries

### Diagnostic Metrics

#### `diagnostic-completion-rate.sql`
**Validates:** Dashboard 2, Step 3.2 (Primary Diagnostic Completion Funnel)

**Compares:**
- PostHog: `diagnostic_started` → `diagnostic_completed` funnel conversion rate
- Supabase: `diagnostics_sessions` started vs completed counts

**Expected Variance:** <5%

**Action if Discrepancy:**
- Check if `diagnostic_completed` events are firing for all completed sessions
- Verify date ranges match exactly
- Check filters (anonymous vs authenticated) match

---

#### `diagnostic-score-by-user-type.sql`
**Validates:** Dashboard 2, Step 3.3 (Completion vs Abandonment)

**Compares:**
- PostHog: Average diagnostic scores by user type
- Supabase: Calculated scores from `diagnostic_responses`

**Expected Variance:** <2% (scores should match exactly)

**Action if Discrepancy:**
- Verify score calculation logic matches PostHog
- Check for missing `diagnostic_responses` records

---

#### `question-dropoff-patterns.sql`
**Validates:** Dashboard 2, Step 3.6 (Question-Level Diagnostic Behavior)

**Compares:**
- PostHog: Drop-off by `questionNumber`
- Supabase: `diagnostic_questions` shown vs `diagnostic_responses` answered

**Expected Variance:** <10% (some variance expected due to timing)

**Action if Discrepancy:**
- Check if all `diagnostic_question_answered` events are firing
- Verify question ordering matches between systems

---

### Acquisition Metrics

#### `signup-completion-rate.sql`
**Validates:** Dashboard 1, Steps 4.2 and 4.4 (Signup Funnel)

**Compares:**
- PostHog: `signup_attempt` → `signup_success` → `email_confirmed` rates
- Supabase: `auth.users` created vs `email_confirmed_at` populated

**Expected Variance:** <3% (should match closely)

**Action if Discrepancy:**
- Verify `signup_success` events fire for all user creations
- Check `email_confirmed` event timing vs `email_confirmed_at` timestamp

---

#### `time-to-trial.sql`
**Validates:** Dashboard 1, Custom Metric (Time from Signup to Trial)

**Compares:**
- PostHog: Time between `signup_success` and `trial_started` events
- Supabase: Time between `auth.users.created_at` and `user_subscriptions.created_at`

**Expected Variance:** <1 hour (some variance due to event timing)

**Action if Discrepancy:**
- Check if `trial_started` events fire immediately when subscription created
- Verify timezone handling matches

---

#### `campaign-attribution-cohort.sql`
**Validates:** Dashboard 1, Step 4.6 (Campaign Performance)

**Compares:**
- PostHog: Campaign attribution from `utm_*` properties
- Supabase: Campaign data from `auth.users.raw_user_meta_data`

**Expected Variance:** <10% (some users may not have metadata)

**Action if Discrepancy:**
- Verify UTM parameters are being stored in user metadata
- Check if campaign tracking is working on all signup flows

---

### Revenue Metrics

#### `mrr-validation.sql`
**Validates:** Dashboard 3, Step 5.2 (MRR Trend)

**Compares:**
- PostHog: Sum of `amount` from `payment_recurring_succeeded` events
- Supabase: Sum of `amount` from `payment_history` where `status = 'succeeded'`

**Expected Variance:** <1% (revenue should match exactly)

**Action if Discrepancy:**
- Critical: Investigate immediately - revenue discrepancies are serious
- Check if all Stripe webhook events are being tracked
- Verify `amount` property is in cents (divide by 100 for dollars)

---

#### `trial-conversion-rate.sql`
**Validates:** Dashboard 3, Step 5.4 (Trial Conversion Funnel)

**Compares:**
- PostHog: `trial_started` → `trial_to_paid_conversion` funnel rate
- Supabase: `user_subscriptions` with `trial_ends_at` vs `status IN ('active', 'trialing')`

**Expected Variance:** <5%

**Action if Discrepancy:**
- Verify `trial_to_paid_conversion` events fire when trial converts
- Check subscription status transitions match event timing

---

## Running Validation Checks

### Weekly Validation Process

1. **Run all validation queries** (can be automated with scheduled SQL jobs)
2. **Compare with PostHog dashboards** (screenshot or export metrics)
3. **Document discrepancies** in `docs/posthog-events-data-dictionary.md`
4. **Investigate significant differences** (>5% variance)
5. **Update queries** if schema changes

### Automated Validation (Future)

Consider creating a scheduled job that:
- Runs validation queries weekly
- Compares results with PostHog API
- Sends alerts if discrepancies exceed thresholds
- Logs results for trend analysis

---

## Troubleshooting

### Query Returns No Results

**Possible Causes:**
- Date range too narrow
- Table name incorrect
- Column names changed
- No data in time period

**Solution:**
- Expand date range
- Verify table/column names with `\d table_name`
- Check if data exists: `SELECT COUNT(*) FROM table_name`

### Results Don't Match PostHog

**Possible Causes:**
- Date range mismatch
- Filter differences
- Timezone differences
- Missing events

**Solution:**
- Align date ranges exactly (use same timezone)
- Check PostHog filters match SQL WHERE clauses
- Verify events are firing for all database records
- Document acceptable variance threshold

### Performance Issues

**Optimization Tips:**
- Add indexes on frequently filtered columns (`created_at`, `user_id`, `status`)
- Use `DATE_TRUNC` for date grouping instead of `DATE()`
- Limit result sets with `LIMIT` when exploring
- Use `EXPLAIN ANALYZE` to identify slow queries

---

## Notes

- All queries use `NOW() - INTERVAL` for relative date ranges
- Queries assume UTC timezone (match PostHog)
- Some queries join multiple tables - verify relationships exist
- Update date ranges based on your analysis needs



