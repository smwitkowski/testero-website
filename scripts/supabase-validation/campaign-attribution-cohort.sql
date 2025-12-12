-- Validation Query: Campaign Attribution Cohort
-- Purpose: Export users from specific campaigns for targeted analysis
-- Run this query and import to PostHog as cohort for Dashboard 1

SELECT DISTINCT 
  u.id as user_id, 
  u.email, 
  u.raw_user_meta_data->>'utm_campaign' as campaign,
  u.raw_user_meta_data->>'utm_source' as source,
  u.raw_user_meta_data->>'utm_medium' as medium,
  u.created_at as signup_date,
  CASE WHEN u.email_confirmed_at IS NOT NULL THEN true ELSE false END as email_confirmed,
  CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_trial
FROM auth.users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.trial_ends_at IS NOT NULL
WHERE u.created_at >= NOW() - INTERVAL '90 days'
  AND u.raw_user_meta_data->>'utm_campaign' IS NOT NULL
ORDER BY signup_date DESC;

-- Campaign performance summary
SELECT 
  u.raw_user_meta_data->>'utm_campaign' as campaign,
  u.raw_user_meta_data->>'utm_source' as source,
  COUNT(DISTINCT u.id) as total_signups,
  COUNT(DISTINCT u.id) FILTER (WHERE u.email_confirmed_at IS NOT NULL) as confirmed,
  COUNT(DISTINCT s.user_id) as trials_started,
  ROUND(100.0 * COUNT(DISTINCT u.id) FILTER (WHERE u.email_confirmed_at IS NOT NULL) / COUNT(DISTINCT u.id), 2) as confirmation_rate_pct,
  ROUND(100.0 * COUNT(DISTINCT s.user_id) / NULLIF(COUNT(DISTINCT u.id), 0), 2) as trial_rate_pct
FROM auth.users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.trial_ends_at IS NOT NULL
WHERE u.created_at >= NOW() - INTERVAL '90 days'
  AND u.raw_user_meta_data->>'utm_campaign' IS NOT NULL
GROUP BY campaign, source
ORDER BY total_signups DESC;




