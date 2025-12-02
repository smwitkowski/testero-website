-- Validation Query: Signup Completion Rate
-- Purpose: Compare PostHog signup_attempt → signup_success → email_confirmed rates
-- Run this query and compare with PostHog Dashboard 1, Steps 4.2 and 4.4

SELECT 
  DATE(u.created_at) as signup_date,
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL) as confirmed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL) / COUNT(*), 2) as confirmation_rate_pct
FROM auth.users u
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(u.created_at)
ORDER BY signup_date DESC;

-- Overall confirmation rate
SELECT 
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL) as confirmed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL) / COUNT(*), 2) as overall_confirmation_rate_pct,
  AVG(EXTRACT(EPOCH FROM (u.email_confirmed_at - u.created_at)) / 3600.0) as avg_hours_to_confirm
FROM auth.users u
WHERE u.created_at >= NOW() - INTERVAL '30 days'
  AND u.email_confirmed_at IS NOT NULL;



