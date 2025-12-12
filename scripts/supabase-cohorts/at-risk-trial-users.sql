-- Cohort: At-Risk Trial Users
-- Purpose: Trial users who haven't completed diagnostic (intervention needed)
-- Export: CSV with columns: user_id, email, days_remaining, diagnostics_completed
-- PostHog Import: Use for trial conversion optimization in Dashboard 3

SELECT 
  u.id as user_id,
  u.email,
  s.trial_ends_at,
  EXTRACT(EPOCH FROM (s.trial_ends_at - NOW())) / 86400.0 as days_remaining,
  COUNT(ds.id) as diagnostic_attempts,
  COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) as diagnostics_completed,
  MAX(ds.started_at) as last_diagnostic_started
FROM auth.users u
JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN diagnostics_sessions ds ON u.id = ds.user_id
WHERE s.status = 'trialing'
  AND s.trial_ends_at > NOW()
GROUP BY u.id, u.email, s.trial_ends_at
HAVING COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) = 0
ORDER BY days_remaining ASC;




