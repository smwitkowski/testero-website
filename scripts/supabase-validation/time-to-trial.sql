-- Validation Query: Time to Trial
-- Purpose: Calculate average hours from signup to trial_started
-- Run this query and add as custom metric to Dashboard 1

SELECT 
  AVG(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as avg_hours_to_trial,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as median_hours_to_trial,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as p25_hours_to_trial,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as p75_hours_to_trial,
  MIN(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as min_hours_to_trial,
  MAX(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as max_hours_to_trial,
  COUNT(*) as total_trials
FROM auth.users u
JOIN user_subscriptions s ON u.id = s.user_id
WHERE s.trial_ends_at IS NOT NULL
  AND u.created_at >= NOW() - INTERVAL '90 days';

-- Breakdown by week
SELECT 
  DATE_TRUNC('week', u.created_at) as signup_week,
  COUNT(*) as trials_started,
  AVG(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 3600.0) as avg_hours_to_trial
FROM auth.users u
JOIN user_subscriptions s ON u.id = s.user_id
WHERE s.trial_ends_at IS NOT NULL
  AND u.created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', u.created_at)
ORDER BY signup_week DESC;



