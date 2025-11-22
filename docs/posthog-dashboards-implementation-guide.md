# PostHog Strategy Dashboards Implementation Guide

This guide provides step-by-step instructions for building three core PostHog dashboards with Supabase validation.

**Created:** 2024-12-19  
**Status:** Implementation in progress

---

## Overview

This implementation creates three dashboards:
1. **Acquisition & Conversion Funnel** - Track visitor → signup → trial → paid conversion
2. **Readiness & Study Activation** - Monitor diagnostic → practice product loop
3. **Subscription & Revenue Health** - Track MRR, churn, and trial performance

Each dashboard includes PostHog configuration steps and Supabase validation queries.

---

## Prerequisites

- PostHog account with admin access
- Supabase database access (read-only for validation queries)
- Access to PostHog MCP for event verification
- CSV export capability for cohort creation

---

## Phase 1: Supabase Schema Validation

### Step 1.1: Verify Table Structures

Run these queries in Supabase SQL Editor to verify schema matches PostHog properties:

```sql
-- Check diagnostics_sessions structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'diagnostics_sessions'
ORDER BY ordinal_position;

-- Check diagnostic_responses structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'diagnostic_responses'
ORDER BY ordinal_position;

-- Check user_subscriptions structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_subscriptions'
ORDER BY ordinal_position;

-- Check payment_history structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'payment_history'
ORDER BY ordinal_position;
```

### Step 1.2: Document Property Mappings

Create a mapping document (see `docs/posthog-supabase-property-mapping.md`):

- `diagnostics_sessions.exam_type` → PostHog `examType`
- `diagnostics_sessions.user_id` vs `anonymous_session_id` → PostHog `userId` and `isAnonymous`
- `user_subscriptions.status` → PostHog `subscription_status`
- `user_subscriptions.plan_id` → PostHog `plan_tier`

---

## Phase 2: Create Supabase Cohorts

### Cohort 1: Active Trialers with Diagnostic Completion

**Purpose:** Identify trial users who have completed diagnostics (high conversion potential)

**Query:** See `scripts/supabase-cohorts/active-trialers-with-diagnostic.sql`

**Export:** CSV with columns: `user_id`, `email`, `trial_ends_at`, `diagnostics_completed`

**PostHog Import:**
1. Go to PostHog → Cohorts → New Cohort
2. Import CSV
3. Name: "Active Trialers - Diagnostic Completed"
4. Use for: Trial conversion analysis in Dashboard 3

### Cohort 2: Power Users

**Purpose:** Users with 2+ completed diagnostics in last 30 days

**Query:** See `scripts/supabase-cohorts/power-users.sql`

**Export:** CSV with columns: `user_id`, `diagnostic_count`, `last_completed`

**PostHog Import:**
1. Name: "Power Users - 2+ Diagnostics"
2. Use for: Engagement analysis in Dashboard 2

### Cohort 3: Churned Users

**Purpose:** Recently churned users for win-back campaigns

**Query:** See `scripts/supabase-cohorts/churned-users.sql`

**Export:** CSV with columns: `user_id`, `email`, `churned_at`, `customer_lifetime_days`

**PostHog Import:**
1. Name: "Churned Users - Last 90 Days"
2. Use for: Churn analysis in Dashboard 3

### Cohort 4: At-Risk Trial Users

**Purpose:** Trial users who haven't completed diagnostic (intervention needed)

**Query:** See `scripts/supabase-cohorts/at-risk-trial-users.sql`

**Export:** CSV with columns: `user_id`, `email`, `days_remaining`, `diagnostics_completed`

**PostHog Import:**
1. Name: "At-Risk Trial Users - No Diagnostic"
2. Use for: Trial conversion optimization in Dashboard 3

---

## Phase 3: Dashboard 2 - Readiness & Study Activation

**Priority:** Build this first (core product loop)

### Step 3.1: Create Dashboard Shell

1. Go to PostHog → Dashboards → New Dashboard
2. Name: **"Readiness & Activation"**
3. Description: "Track diagnostic → practice product loop and user engagement"
4. Tags: `strategy`, `product`, `diagnostic`
5. Access: Team access

### Step 3.2: Primary Diagnostic Completion Funnel

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `diagnostic_started`
- **Step 2:** Event `diagnostic_question_answered` with property filter `questionNumber = 1`
- **Step 3:** Event `diagnostic_question_answered` with property filter `questionNumber >= 18` (or `totalQuestions - 1`)
- **Step 4:** Event `diagnostic_completed`
- **Step 5:** Event `diagnostic_summary_viewed`

**Settings:**
- Conversion window: **7 days** (or same-day if users complete quickly)
- Breakdowns: `examType`, `isAnonymous`
- Date range: Last 30 days (default)

**Add to dashboard** as primary top-left widget

**Validation:** Run Supabase query from `scripts/supabase-validation/diagnostic-completion-rate.sql` and compare rates

### Step 3.3: Completion vs Abandonment Over Time

**Insight Type:** Trends (Stacked Bar or Line Chart)

**Configuration:**
- **Series 1:** Count of `diagnostic_started`
- **Series 2:** Count of `diagnostic_completed`
- **Series 3:** Count of `diagnostic_abandoned` (if available, otherwise calculate as started - completed)

**Settings:**
- Interval: **Week**
- Date range: Last 90 days
- Formula: Add derived metric `diagnostic_completed / diagnostic_started` as completion rate percentage

**Add to dashboard** top-right

### Step 3.4: Diagnostic → Practice Activation Funnel

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `diagnostic_completed`
- **Step 2:** Event `diagnostic_summary_viewed`
- **Step 3:** Event `practice_started`

**Settings:**
- Conversion window: **24 hours** (measure immediate activation)
- Breakdowns:
  - `score` buckets: `<60`, `60-74`, `75-84`, `85+`
  - `examType`

**Add to dashboard** second row, left

**Validation:** Cross-reference with Supabase query for practice engagement after diagnostic

### Step 3.5: Practice Intensity Metrics

**Insight Type:** Trends

**Configuration:**
- **Series 1:** Count of `practice_started` per day
- **Series 2:** Count of `practice_question_answered` per day
- **Series 3:** `practice_question_answered` with math = **"per user"** (average questions per user per day)

**Settings:**
- Interval: **Day**
- Date range: Last 30 days
- Optional breakdown: `topics` property on `practice_started`

**Add to dashboard** second row, right

### Step 3.6: Question-Level Diagnostic Behavior

**Insight Type:** Trends (Bar Chart)

**Configuration:**
- Event: `diagnostic_question_answered`
- Breakdown: `questionNumber`
- Metric: Count of events

**Purpose:** Identify where users drop off during diagnostic

**Second View:**
- Breakdown: `isCorrect` and `examType`
- Purpose: See which exams are hardest

**Add to dashboard** third row, left

### Step 3.7: Study Path Engagement

**Insight Type:** Trends

**Configuration:**
- **Series 1:** Count of `study_path_viewed`
- **Series 2:** Count of `study_path_generated`
- **Series 3:** Count of `study_path_error`

**KPI Tile:**
- Create separate single-value insight: `study_path_viewed / diagnostic_completed` ratio
- Use formula or two tiles side-by-side

**Add to dashboard** third row, right

### Step 3.8: Validate with Supabase

Run validation queries from `scripts/supabase-validation/`:
- `diagnostic-completion-rate.sql` - Compare PostHog funnel rates
- `diagnostic-score-by-user-type.sql` - Validate score calculations
- `question-dropoff-patterns.sql` - Cross-reference drop-off analysis

**Action Items:**
- Document any discrepancies >5% between PostHog and Supabase
- Update data dictionary with findings

---

## Phase 4: Dashboard 1 - Acquisition & Conversion Funnel

**Priority:** Build second (acquisition metrics)

### Step 4.1: Create Dashboard Shell

1. Go to PostHog → Dashboards → New Dashboard
2. Name: **"Acquisition & Conversion"**
3. Description: "Track visitor → signup → trial → paid conversion with campaign attribution"
4. Tags: `strategy`, `growth`, `top-of-funnel`
5. Access: Team access

### Step 4.2: Main Conversion Funnel

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `$pageview` with filter `$current_url` contains `/` (or `/beta` if that's your landing page)
- **Step 2:** Event `signup_attempt`
- **Step 3:** Event `signup_success`
- **Step 4:** Event `email_confirmed` (verify this event exists in PostHog first)
- **Step 5:** Event `trial_started`
- **Step 6:** Event `subscription_created` OR `subscription_created_webhook` (use whichever has higher volume)

**Settings:**
- Conversion window: **30 days**
- Breakdowns: `utm_campaign`, `utm_source`, `examType` (where available)
- Date range: Last 90 days

**Add to dashboard** as primary top-left widget

**Naming:** `A1 – Visitor → Paid Funnel`

### Step 4.3: Signup Health Trends

**Insight Type:** Trends (Line Chart)

**Configuration:**
- **Series 1:** Count of `signup_attempt`
- **Series 2:** Count of `signup_success`
- **Series 3:** Count of `signup_error`
- **Series 4:** Count of `signup_rate_limited`

**Settings:**
- Interval: **Day**
- Date range: Last 90 days
- Formula: Add derived series `signup_success / signup_attempt` as percentage
- Breakdown: `$device_type` (mobile vs desktop)

**Add to dashboard** top-right

**Naming:** `A2 – Signup Health Trends`

### Step 4.4: Email Verification Completion

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `signup_success`
- **Step 2:** Event `email_confirmed`

**Settings:**
- Conversion window: **7 days**
- Breakdowns: `$device_type`, `$geoip_country_name`
- Date range: Last 30 days

**Add single-value KPI tile** showing completion rate percentage

**Naming:** `A3 – Email Verification Funnel`

**Validation:** Run Supabase query `signup-completion-rate.sql` and compare rates

### Step 4.5: Trial Funnel Performance

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `trial_modal_shown`
- **Step 2:** Event `trial_cta_clicked`
- **Step 3:** Event `trial_started`
- **Step 4:** Event `trial_to_paid_conversion` (verify this event exists)

**Settings:**
- Conversion window: **30 days**
- Breakdown: `diagnostic_score` buckets (`<60`, `60-79`, `80+`)
- Date range: Last 90 days

**Add to dashboard** second row, left

**Naming:** `A4 – Trial Conversion Funnel`

### Step 4.6: Campaign Performance Table

**Insight Type:** Trends (Table View)

**Configuration:**
- Filter: Events where `utm_campaign` is not empty
- Group by: `utm_campaign`, `utm_source`

**Metrics (separate series or table columns):**
- Count of `email_campaign_landing`
- Count of `signup_success`
- Count of `trial_started`
- Count of `subscription_created`

**Calculated Column:** `subscription_created / email_campaign_landing` as conversion ratio

**Add to dashboard** second row, right

**Naming:** `A5 – Campaign Performance`

**Validation:** Export campaign cohort from Supabase and cross-reference

### Step 4.7: Validate with Supabase

Run validation queries:
- `signup-completion-rate.sql` - Compare PostHog signup rates
- `time-to-trial.sql` - Calculate average hours from signup to trial
- `campaign-attribution-cohort.sql` - Export campaign users for analysis

---

## Phase 5: Dashboard 3 - Subscription & Revenue Health

**Priority:** Build third (revenue metrics)

### Step 5.1: Create Dashboard Shell

1. Go to PostHog → Dashboards → New Dashboard
2. Name: **"Subscription & Revenue"**
3. Description: "Track MRR, churn, trial performance, and payment reliability"
4. Tags: `strategy`, `revenue`, `billing`
5. Access: Team access

### Step 5.2: Revenue / MRR Trend

**Insight Type:** Trends (Area or Line Chart)

**Configuration:**
- Event: `payment_recurring_succeeded` (primary)
- Optional: `payment_one_time_succeeded` for one-off revenue
- Metric: **Sum of `amount`** (note: amount is in cents, divide by 100 for dollars)
- Math: None (sum is correct)

**Settings:**
- Interval: **Month**
- Date range: Last 6 months
- Breakdown: `plan_tier` (if available from webhook properties)

**Add to dashboard** top-left

**Naming:** `S1 – MRR Trend`

**Validation:** Run Supabase query `mrr-validation.sql` and compare monthly totals

### Step 5.3: New vs Cancelled Subscriptions

**Insight Type:** Trends (Bar or Line Chart)

**Configuration:**
- **Series 1:** Count of `subscription_created`
- **Series 2:** Count of `subscription_cancelled`
- **Series 3:** Formula: `subscription_created - subscription_cancelled` (net subscriptions)

**Settings:**
- Interval: **Month**
- Date range: Last 6 months

**Add to dashboard** top-right

**Naming:** `S2 – Subscription Changes`

### Step 5.4: Trial Conversion Funnel

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `trial_started`
- **Step 2:** Event `trial_to_paid_conversion` OR first `subscription_created` for that user

**Settings:**
- Conversion window: **30 days**
- Breakdowns:
  - `exam_type` (from user properties)
  - Trial engagement (if you add practice question count property)

**Add to dashboard** second row, left

**Naming:** `S3 – Trial → Paid Funnel`

**Validation:** Run Supabase query `trial-conversion-rate.sql` and compare rates

### Step 5.5: Churn Insights

**Insight Type:** Trends (Bar Chart)

**Configuration:**
- Event: `subscription_cancelled`
- Metric: Count per month

**Settings:**
- Interval: **Month**
- Date range: Last 6 months

**Second View (if `cancellation_reason` property exists):**
- Breakdown: `cancellation_reason`
- Purpose: Understand why users cancel

**Add to dashboard** second row, right

**Naming:** `S4 – Churn Analysis`

### Step 5.6: Payment Reliability

**Insight Type:** Trends

**Configuration:**
- **Series 1:** Count of `payment_failed`
- **Series 2:** Count of `payment_recurring_succeeded`
- **Series 3:** Formula: `payment_failed / (payment_failed + payment_recurring_succeeded)` as failure rate

**Settings:**
- Interval: **Week**
- Date range: Last 90 days
- Optional breakdown: `$geoip_country_name` (detect regional issues)

**Add to dashboard** third row, left

**Naming:** `S5 – Payment Reliability`

### Step 5.7: Upsell Effectiveness Funnel

**Insight Type:** Funnel

**Configuration:**
- **Step 1:** Event `upsell_view` (or `gate_viewed` if that's the actual name)
- **Step 2:** Event `gate_cta_clicked`
- **Step 3:** Event `checkout_initiated`
- **Step 4:** Event `subscription_created`

**Settings:**
- Conversion window: **7 days**
- Breakdowns:
  - `variant` (upsell variant)
  - `abBucket` (A/B test bucket)
  - `weakDomains` length (bucketed: 0, 1-2, 3+)

**Add to dashboard** third row, right

**Naming:** `S6 – Upsell Funnel`

### Step 5.8: Validate with Supabase

Run validation queries:
- `mrr-validation.sql` - Compare PostHog MRR with database
- `trial-conversion-rate.sql` - Validate trial conversion rates
- `at-risk-trial-users.sql` - Identify users needing intervention

---

## Phase 6: Post-Implementation Quality Checks

### Step 6.1: Weekly Supabase Quality Checks

Create a scheduled task (weekly) to run these queries:

**Missing Events Check:**
```sql
-- Find completed diagnostics without PostHog events
SELECT id, user_id, exam_type, completed_at
FROM diagnostics_sessions
WHERE completed_at IS NOT NULL
  AND completed_at >= NOW() - INTERVAL '7 days'
ORDER BY completed_at DESC
LIMIT 100;
```
Cross-reference with PostHog `diagnostic_completed` events.

**Orphaned Anonymous Sessions:**
```sql
SELECT 
  COUNT(*) as orphaned_sessions,
  COUNT(DISTINCT anonymous_session_id) as unique_anonymous_ids
FROM diagnostics_sessions
WHERE anonymous_session_id IS NOT NULL
  AND user_id IS NULL
  AND started_at >= NOW() - INTERVAL '90 days';
```

**Subscription-Payment Mismatch:**
```sql
SELECT s.id, s.user_id, s.stripe_subscription_id, s.status, s.created_at
FROM user_subscriptions s
WHERE s.status IN ('active', 'trialing')
  AND s.created_at >= NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM payment_history p
    WHERE p.user_id = s.user_id
      AND p.status = 'succeeded'
  );
```

### Step 6.2: Metric Drift Alerts

Set up PostHog alerts for:
- Diagnostic completion rate drops below 60%
- Trial conversion rate drops below 20%
- Payment failure rate exceeds 5%
- Signup success rate drops below 80%

### Step 6.3: Documentation Updates

Update `docs/posthog-events-data-dictionary.md` with:
- Any discrepancies found between PostHog and Supabase
- New cohorts created
- Custom metrics calculated
- Schema changes that impact PostHog properties

---

## Troubleshooting

### Issue: Event not found in PostHog

**Solution:**
1. Check event name spelling (case-sensitive)
2. Verify event is actually being fired (check PostHog event explorer)
3. Check date range (event might be older than expected)
4. Verify filters aren't excluding the event

### Issue: Supabase query returns different numbers than PostHog

**Possible Causes:**
1. Date range mismatch
2. Filter differences (anonymous vs authenticated users)
3. Event not firing for all database records
4. Timezone differences

**Solution:**
1. Align date ranges exactly
2. Check filters match between PostHog and SQL
3. Investigate missing events
4. Document acceptable variance threshold (e.g., <5%)

### Issue: Cohort import fails in PostHog

**Solution:**
1. Verify CSV format matches PostHog requirements
2. Check user IDs are valid UUIDs
3. Ensure required columns are present
4. Try importing smaller batches (1000 users at a time)

---

## Success Criteria

✅ All three dashboards created and populated  
✅ Supabase validation queries run and documented  
✅ 4+ cohorts exported and imported to PostHog  
✅ Metric discrepancies <5% between PostHog and Supabase  
✅ Weekly quality check process established  
✅ Data dictionary updated with findings  

---

## Next Steps After Implementation

1. **Week 1:** Monitor dashboards daily, identify any data quality issues
2. **Week 2:** Refine breakdowns and filters based on usage patterns
3. **Week 3:** Create additional insights based on questions from stakeholders
4. **Ongoing:** Run weekly Supabase quality checks and update documentation

---

## Support & Questions

For questions or issues during implementation:
- Check PostHog documentation: https://posthog.com/docs
- Review data dictionary: `docs/posthog-events-data-dictionary.md`
- Check Supabase schema: Run `\d table_name` in SQL editor
