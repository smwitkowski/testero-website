-- Validation Query: Trial Conversion Rate
-- Purpose: Compare PostHog trial_started → trial_to_paid_conversion funnel rates
-- Run this query and compare with PostHog Dashboard 3, Step 5.4

WITH trials AS (
  SELECT 
    user_id, 
    trial_ends_at, 
    status,
    created_at as trial_started_at,
    EXTRACT(EPOCH FROM (trial_ends_at - created_at)) / 86400.0 as trial_length_days
  FROM user_subscriptions
  WHERE trial_ends_at IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
)
SELECT 
  COUNT(*) as total_trials,
  COUNT(*) FILTER (WHERE status IN ('active', 'trialing')) as converted,
  COUNT(*) FILTER (WHERE status = 'canceled') as cancelled,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('active', 'trialing')) / 
        NULLIF(COUNT(*), 0), 2) as conversion_rate_pct,
  ROUND(AVG(trial_length_days), 1) as avg_trial_length_days
FROM trials;

-- Conversion rate by exam type (if available in user metadata)
SELECT 
  u.raw_user_meta_data->>'exam_type' as exam_type,
  COUNT(*) as total_trials,
  COUNT(*) FILTER (WHERE s.status IN ('active', 'trialing')) as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE s.status IN ('active', 'trialing')) / 
        NULLIF(COUNT(*), 0), 2) as conversion_rate_pct
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.trial_ends_at IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '90 days'
  AND u.raw_user_meta_data->>'exam_type' IS NOT NULL
GROUP BY exam_type
ORDER BY conversion_rate_pct DESC;

-- Conversion rate by trial engagement (diagnostics completed)
SELECT 
  CASE 
    WHEN COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) = 0 THEN 'No diagnostic'
    WHEN COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) = 1 THEN '1 diagnostic'
    ELSE '2+ diagnostics'
  END as engagement_level,
  COUNT(DISTINCT s.user_id) as total_trials,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.status IN ('active', 'trialing')) as converted,
  ROUND(100.0 * COUNT(DISTINCT s.user_id) FILTER (WHERE s.status IN ('active', 'trialing')) / 
        NULLIF(COUNT(DISTINCT s.user_id), 0), 2) as conversion_rate_pct
FROM user_subscriptions s
LEFT JOIN diagnostics_sessions ds ON s.user_id = ds.user_id
WHERE s.trial_ends_at IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY engagement_level
ORDER BY conversion_rate_pct DESC;




