# PostHog Dashboards Implementation Checklist

Use this checklist to track progress through the implementation.

---

## Phase 1: Supabase Schema Validation ✅

- [x] Implementation guide created (`docs/posthog-dashboards-implementation-guide.md`)
- [x] Property mapping document created (`docs/posthog-supabase-property-mapping.md`)
- [x] All cohort SQL queries created (`scripts/supabase-cohorts/`)
- [x] All validation SQL queries created (`scripts/supabase-validation/`)
- [ ] **TODO:** Run schema validation queries in Supabase SQL Editor
- [ ] **TODO:** Document any schema discrepancies found

---

## Phase 2: Supabase Cohort Export

- [ ] **TODO:** Run `active-trialers-with-diagnostic.sql` in Supabase
- [ ] **TODO:** Export results as CSV
- [ ] **TODO:** Import to PostHog as cohort "Active Trialers - Diagnostic Completed"

- [ ] **TODO:** Run `power-users.sql` in Supabase
- [ ] **TODO:** Export results as CSV
- [ ] **TODO:** Import to PostHog as cohort "Power Users - 2+ Diagnostics"

- [ ] **TODO:** Run `churned-users.sql` in Supabase
- [ ] **TODO:** Export results as CSV
- [ ] **TODO:** Import to PostHog as cohort "Churned Users - Last 90 Days"

- [ ] **TODO:** Run `at-risk-trial-users.sql` in Supabase
- [ ] **TODO:** Export results as CSV
- [ ] **TODO:** Import to PostHog as cohort "At-Risk Trial Users - No Diagnostic"

---

## Phase 3: Dashboard 2 - Readiness & Study Activation

- [ ] **TODO:** Create dashboard shell "Readiness & Activation"
- [ ] **TODO:** Create insight A1 - Primary Diagnostic Completion Funnel
- [ ] **TODO:** Create insight A2 - Completion vs Abandonment Over Time
- [ ] **TODO:** Create insight A3 - Diagnostic → Practice Activation Funnel
- [ ] **TODO:** Create insight A4 - Practice Intensity Metrics
- [ ] **TODO:** Create insight A5 - Question-Level Diagnostic Behavior
- [ ] **TODO:** Create insight A6 - Study Path Engagement
- [ ] **TODO:** Run validation query `diagnostic-completion-rate.sql`
- [ ] **TODO:** Compare PostHog rates with Supabase results
- [ ] **TODO:** Document any discrepancies >5%

---

## Phase 4: Dashboard 1 - Acquisition & Conversion Funnel

- [ ] **TODO:** Create dashboard shell "Acquisition & Conversion"
- [ ] **TODO:** Create insight A1 - Visitor → Paid Funnel
- [ ] **TODO:** Create insight A2 - Signup Health Trends
- [ ] **TODO:** Create insight A3 - Email Verification Funnel
- [ ] **TODO:** Create insight A4 - Trial Conversion Funnel
- [ ] **TODO:** Create insight A5 - Campaign Performance Table
- [ ] **TODO:** Run validation query `signup-completion-rate.sql`
- [ ] **TODO:** Run validation query `time-to-trial.sql`
- [ ] **TODO:** Run validation query `campaign-attribution-cohort.sql`
- [ ] **TODO:** Compare PostHog metrics with Supabase results
- [ ] **TODO:** Document any discrepancies >5%

---

## Phase 5: Dashboard 3 - Subscription & Revenue Health

- [ ] **TODO:** Create dashboard shell "Subscription & Revenue"
- [ ] **TODO:** Create insight S1 - MRR Trend
- [ ] **TODO:** Create insight S2 - Subscription Changes
- [ ] **TODO:** Create insight S3 - Trial → Paid Funnel
- [ ] **TODO:** Create insight S4 - Churn Analysis
- [ ] **TODO:** Create insight S5 - Payment Reliability
- [ ] **TODO:** Create insight S6 - Upsell Funnel
- [ ] **TODO:** Run validation query `mrr-validation.sql`
- [ ] **TODO:** Run validation query `trial-conversion-rate.sql`
- [ ] **TODO:** Compare PostHog MRR with Supabase (critical - must match within 1%)
- [ ] **TODO:** Document any discrepancies

---

## Phase 6: Post-Implementation Quality Checks

- [ ] **TODO:** Set up weekly Supabase quality check schedule
- [ ] **TODO:** Create PostHog alerts for:
  - [ ] Diagnostic completion rate <60%
  - [ ] Trial conversion rate <20%
  - [ ] Payment failure rate >5%
  - [ ] Signup success rate <80%
- [ ] **TODO:** Update data dictionary with any findings
- [ ] **TODO:** Document acceptable variance thresholds
- [ ] **TODO:** Create runbook for investigating discrepancies

---

## Notes

- Check off items as you complete them
- Add notes for any issues encountered
- Update dates when phases are completed
- Reference implementation guide for detailed steps

---

## Completion Status

**Phase 1:** ✅ Complete (Documentation ready)  
**Phase 2:** ⏳ Ready to start (SQL queries prepared)  
**Phase 3:** ⏳ Pending Phase 2  
**Phase 4:** ⏳ Pending Phase 2  
**Phase 5:** ⏳ Pending Phase 2  
**Phase 6:** ⏳ Pending Phases 3-5  

---

**Last Updated:** 2024-12-19



