# Supabase Cohorts for PostHog

This directory contains SQL queries to create user cohorts that can be exported and imported into PostHog for advanced segmentation.

## Usage

1. Run each SQL query in Supabase SQL Editor
2. Export results as CSV
3. Import CSV into PostHog as a cohort
4. Use cohorts to filter insights in dashboards

## Cohorts

### 1. Active Trialers with Diagnostic Completion
**File:** `active-trialers-with-diagnostic.sql`

**Purpose:** Identify trial users who have completed diagnostics (high conversion potential)

**Use Cases:**
- Trial conversion analysis in Dashboard 3
- Targeted messaging for engaged trial users
- Understanding what drives trial → paid conversion

**Columns:**
- `user_id` - UUID for PostHog import
- `email` - User email
- `trial_ends_at` - When trial expires
- `days_remaining` - Days left in trial
- `diagnostics_completed` - Number of completed diagnostics

---

### 2. Power Users
**File:** `power-users.sql`

**Purpose:** Users with 2+ completed diagnostics in last 30 days

**Use Cases:**
- Engagement analysis in Dashboard 2
- Identify most active users for product research
- Measure feature adoption among power users

**Columns:**
- `user_id` - UUID for PostHog import
- `diagnostic_count` - Number of diagnostics completed
- `last_completed` - Most recent diagnostic completion date
- `exam_types` - Comma-separated list of exam types taken

---

### 3. Churned Users
**File:** `churned-users.sql`

**Purpose:** Recently churned users for win-back campaigns

**Use Cases:**
- Churn analysis in Dashboard 3
- Win-back email campaigns
- Understanding churn patterns

**Columns:**
- `user_id` - UUID for PostHog import
- `email` - User email
- `churned_at` - Cancellation date
- `customer_lifetime_days` - How long they were a customer
- `total_diagnostics_completed` - Engagement metric

---

### 4. At-Risk Trial Users
**File:** `at-risk-trial-users.sql`

**Purpose:** Trial users who haven't completed diagnostic (intervention needed)

**Use Cases:**
- Trial conversion optimization in Dashboard 3
- Proactive outreach to trial users
- Identify users who need help getting started

**Columns:**
- `user_id` - UUID for PostHog import
- `email` - User email
- `days_remaining` - Days left in trial
- `diagnostics_completed` - Should be 0 for this cohort
- `last_diagnostic_started` - Last attempt (if any)

---

## PostHog Import Instructions

1. **Export from Supabase:**
   - Run query in Supabase SQL Editor
   - Click "Export" → "CSV"
   - Save file with descriptive name (e.g., `power-users-2024-12-19.csv`)

2. **Import to PostHog:**
   - Go to PostHog → Cohorts → New Cohort
   - Click "Import from CSV"
   - Upload CSV file
   - Map `user_id` column to PostHog user ID field
   - Name cohort descriptively
   - Save cohort

3. **Use in Dashboards:**
   - When creating insights, add cohort filter
   - Select imported cohort from dropdown
   - Apply to any insight for segmentation

---

## Maintenance

- **Refresh Frequency:** Weekly or monthly depending on use case
- **Date Ranges:** Update `INTERVAL` clauses in queries to match your analysis window
- **Validation:** After importing, verify cohort size matches expectations

---

## Notes

- All queries filter for recent data (last 30-90 days) to keep cohorts manageable
- User IDs must be valid UUIDs for PostHog import
- Some cohorts may be empty if criteria aren't met - this is expected
- Export smaller batches (1000 users) if PostHog import fails




