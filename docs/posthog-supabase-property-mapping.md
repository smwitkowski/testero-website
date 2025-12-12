# PostHog ↔ Supabase Property Mapping

This document maps PostHog event properties to Supabase database columns for validation and cross-referencing.

**Created:** 2024-12-19  
**Last Updated:** 2024-12-19

---

## Table of Contents

1. [Diagnostic Events](#diagnostic-events)
2. [Authentication Events](#authentication-events)
3. [Subscription Events](#subscription-events)
4. [Payment Events](#payment-events)
5. [User Properties](#user-properties)

---

## Diagnostic Events

### `diagnostic_started`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `sessionId` | `diagnostics_sessions.id` | UUID string |
| `examType` | `diagnostics_sessions.exam_type` | String (e.g., "AWS SAA-C03") |
| `questionCount` | `diagnostics_sessions.question_count` | Integer |
| `userId` | `diagnostics_sessions.user_id` | UUID, null for anonymous |
| `isAnonymous` | `diagnostics_sessions.anonymous_session_id IS NOT NULL` | Boolean |

**Validation Query:**
```sql
SELECT id, exam_type, question_count, user_id, anonymous_session_id, started_at
FROM diagnostics_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
ORDER BY started_at DESC;
```

---

### `diagnostic_question_answered`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `sessionId` | `diagnostic_responses.session_id` | Links to diagnostics_sessions |
| `questionNumber` | `diagnostic_questions.question_order` | Integer (1-indexed) |
| `questionId` | `diagnostic_responses.question_id` | Links to questions table |
| `selectedAnswer` | `diagnostic_responses.selected_option_label` | String (A, B, C, D) |
| `isCorrect` | `diagnostic_responses.is_correct` | Boolean |
| `examType` | `diagnostics_sessions.exam_type` | Via join |
| `totalQuestions` | `diagnostics_sessions.question_count` | Via join |

**Validation Query:**
```sql
SELECT 
  dr.session_id,
  dq.question_order as question_number,
  dr.selected_option_label,
  dr.is_correct,
  ds.exam_type,
  ds.question_count as total_questions
FROM diagnostic_responses dr
JOIN diagnostic_questions dq ON dr.diagnostic_question_id = dq.id
JOIN diagnostics_sessions ds ON dr.session_id = ds.id
WHERE dr.created_at >= NOW() - INTERVAL '30 days'
ORDER BY dr.created_at DESC;
```

---

### `diagnostic_completed`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `sessionId` | `diagnostics_sessions.id` | UUID |
| `examType` | `diagnostics_sessions.exam_type` | String |
| `totalQuestions` | `diagnostics_sessions.question_count` | Integer |
| `userId` | `diagnostics_sessions.user_id` | UUID or null |
| `isAnonymous` | `diagnostics_sessions.anonymous_session_id IS NOT NULL` | Boolean |

**Validation Query:**
```sql
SELECT id, exam_type, question_count, user_id, anonymous_session_id, completed_at
FROM diagnostics_sessions
WHERE completed_at IS NOT NULL
  AND completed_at >= NOW() - INTERVAL '30 days'
ORDER BY completed_at DESC;
```

---

### `diagnostic_summary_viewed`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `sessionId` | `diagnostics_sessions.id` | UUID |
| `examType` | `diagnostics_sessions.exam_type` | String |
| `score` | Calculated from `diagnostic_responses.is_correct` | Percentage |
| `totalQuestions` | `diagnostics_sessions.question_count` | Integer |
| `correctAnswers` | `COUNT(*) FILTER (WHERE is_correct)` | Integer |
| `domainCount` | Count of distinct domains | Integer |

**Score Calculation:**
```sql
SELECT 
  s.id as session_id,
  s.exam_type,
  s.question_count as total_questions,
  COUNT(*) FILTER (WHERE dr.is_correct) as correct_answers,
  ROUND(100.0 * COUNT(*) FILTER (WHERE dr.is_correct) / NULLIF(COUNT(*), 0), 2) as score_pct
FROM diagnostics_sessions s
JOIN diagnostic_responses dr ON s.id = dr.session_id
WHERE s.completed_at IS NOT NULL
  AND s.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY s.id, s.exam_type, s.question_count;
```

---

## Authentication Events

### `signup_success`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `email` | `auth.users.email` | String |
| `guestUpgraded` | `diagnostics_sessions.user_id IS NOT NULL` | Boolean (check if anonymous sessions exist) |
| `sessionsTransferred` | `COUNT(*)` from diagnostics_sessions | Integer |

**Validation Query:**
```sql
SELECT 
  u.id,
  u.email,
  u.created_at,
  COUNT(ds.id) FILTER (WHERE ds.anonymous_session_id IS NOT NULL) as sessions_transferred
FROM auth.users u
LEFT JOIN diagnostics_sessions ds ON u.id = ds.user_id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.created_at;
```

---

### `email_confirmed`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `userId` | `auth.users.id` | UUID |
| `email` | `auth.users.email` | String |

**Validation Query:**
```sql
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
  AND email_confirmed_at >= NOW() - INTERVAL '30 days'
ORDER BY email_confirmed_at DESC;
```

---

## Subscription Events

### `trial_started`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `email` | `auth.users.email` | String |
| `trial_days` | `EXTRACT(EPOCH FROM (trial_ends_at - created_at)) / 86400` | Integer (typically 14) |
| `price_id` | `subscription_plans.stripe_price_id_monthly` | String (via plan_id join) |
| `tier_name` | `subscription_plans.tier` | String (via plan_id join) |
| `from_anonymous` | Check if user had anonymous sessions | Boolean |
| `anonymous_session_id` | `diagnostics_sessions.anonymous_session_id` | UUID or null |

**Validation Query:**
```sql
SELECT 
  u.email,
  s.created_at as trial_started_at,
  s.trial_ends_at,
  EXTRACT(EPOCH FROM (s.trial_ends_at - s.created_at)) / 86400.0 as trial_days,
  sp.tier as tier_name,
  sp.stripe_price_id_monthly as price_id,
  COUNT(ds.id) FILTER (WHERE ds.anonymous_session_id IS NOT NULL) > 0 as from_anonymous
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN diagnostics_sessions ds ON u.id = ds.user_id
WHERE s.trial_ends_at IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.email, s.created_at, s.trial_ends_at, sp.tier, sp.stripe_price_id_monthly;
```

---

### `subscription_created`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `plan_name` | `subscription_plans.name` | String |
| `plan_tier` | `subscription_plans.tier` | String |
| `price_id` | `subscription_plans.stripe_price_id_monthly` or `stripe_price_id_yearly` | String |
| `amount` | `payment_history.amount` | Integer (cents) |
| `currency` | `payment_history.currency` | String (e.g., "usd") |
| `billing_interval` | Determined from price_id | "monthly" or "yearly" |
| `stripe_customer_id` | `user_subscriptions.stripe_customer_id` | String |
| `stripe_subscription_id` | `user_subscriptions.stripe_subscription_id` | String |
| `subscription_status` | `user_subscriptions.status` | String |

**Validation Query:**
```sql
SELECT 
  s.id,
  u.email,
  sp.name as plan_name,
  sp.tier as plan_tier,
  s.status as subscription_status,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.created_at
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
ORDER BY s.created_at DESC;
```

---

### `subscription_cancelled`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `stripe_subscription_id` | `user_subscriptions.stripe_subscription_id` | String |
| `cancellation_reason` | `user_subscriptions.cancellation_reason` | String (if stored) |

**Validation Query:**
```sql
SELECT 
  s.stripe_subscription_id,
  u.email,
  s.updated_at as cancelled_at,
  s.status
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.status = 'canceled'
  AND s.updated_at >= NOW() - INTERVAL '90 days'
ORDER BY s.updated_at DESC;
```

---

## Payment Events

### `payment_recurring_succeeded`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `amount` | `payment_history.amount` | Integer (cents) |
| `currency` | `payment_history.currency` | String |
| `stripe_payment_intent_id` | `payment_history.stripe_payment_intent_id` | String |
| `stripe_invoice_id` | Not directly stored | May be in Stripe metadata |
| `stripe_subscription_id` | `user_subscriptions.stripe_subscription_id` | Via user_id join |

**Validation Query:**
```sql
SELECT 
  ph.amount / 100.0 as amount_dollars,
  ph.currency,
  ph.stripe_payment_intent_id,
  ph.status,
  ph.created_at,
  s.stripe_subscription_id
FROM payment_history ph
LEFT JOIN user_subscriptions s ON ph.user_id = s.user_id
WHERE ph.status = 'succeeded'
  AND ph.created_at >= NOW() - INTERVAL '30 days'
ORDER BY ph.created_at DESC;
```

---

### `payment_failed`

| PostHog Property | Supabase Table.Column | Notes |
|-----------------|----------------------|-------|
| `amount` | `payment_history.amount` | Integer (cents) |
| `currency` | `payment_history.currency` | String |
| `stripe_payment_intent_id` | `payment_history.stripe_payment_intent_id` | String |
| `failure_reason` | Not directly stored | May need to query Stripe API |

**Validation Query:**
```sql
SELECT 
  ph.amount / 100.0 as amount_dollars,
  ph.currency,
  ph.stripe_payment_intent_id,
  ph.status,
  ph.created_at,
  u.email
FROM payment_history ph
JOIN auth.users u ON ph.user_id = u.id
WHERE ph.status = 'failed'
  AND ph.created_at >= NOW() - INTERVAL '30 days'
ORDER BY ph.created_at DESC;
```

---

## User Properties

PostHog user properties set via `posthog.identify()` map to Supabase as follows:

| PostHog Property | Supabase Source | Notes |
|-----------------|----------------|-------|
| `email` | `auth.users.email` | String |
| `user_id` | `auth.users.id` | UUID |
| `subscription_tier` | `subscription_plans.tier` | Via user_subscriptions join |
| `subscription_status` | `user_subscriptions.status` | String |
| `is_paying_customer` | `user_subscriptions.status IN ('active', 'trialing')` | Boolean |
| `is_trial` | `user_subscriptions.trial_ends_at IS NOT NULL` | Boolean |
| `customer_since` | `user_subscriptions.created_at` | ISO timestamp |
| `churned_at` | `user_subscriptions.updated_at WHERE status = 'canceled'` | ISO timestamp |
| `exam_type` | `auth.users.raw_user_meta_data->>'exam_type'` | String (from metadata) |
| `readiness_score` | Calculated from latest diagnostic | Percentage |
| `email_verified` | `auth.users.email_confirmed_at IS NOT NULL` | Boolean |

**User Properties Query:**
```sql
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_verified,
  s.status as subscription_status,
  sp.tier as subscription_tier,
  s.trial_ends_at IS NOT NULL as is_trial,
  s.status IN ('active', 'trialing') as is_paying_customer,
  s.created_at as customer_since,
  CASE WHEN s.status = 'canceled' THEN s.updated_at ELSE NULL END as churned_at
FROM auth.users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.created_at >= NOW() - INTERVAL '90 days';
```

---

## Notes

- **Time Zones:** PostHog uses UTC. Supabase `created_at` timestamps are also UTC. Ensure date comparisons account for timezone differences if needed.

- **Null Handling:** PostHog `userId: null` for anonymous users maps to `diagnostics_sessions.user_id IS NULL` in Supabase.

- **Calculated Properties:** Some PostHog properties (like `score`, `readiness_score`) are calculated from multiple database columns. Use the provided validation queries to replicate these calculations.

- **Metadata Properties:** Campaign attribution (`utm_*`) may be stored in `auth.users.raw_user_meta_data` JSONB column. Access via `->>'key'` operator.

- **Validation Frequency:** Run validation queries weekly to ensure PostHog and Supabase remain in sync. Document any discrepancies >5% in the data dictionary.




