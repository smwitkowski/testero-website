-- Cohort: Active Trialers with Diagnostic Completion
-- Purpose: Identify trial users who have completed diagnostics (high conversion potential)
-- Export: CSV with columns: user_id, email, trial_ends_at, diagnostics_completed
-- PostHog Import: Use for trial conversion analysis in Dashboard 3

SELECT DISTINCT
  u.id as user_id,
  u.email,
  s.trial_ends_at,
  EXTRACT(EPOCH FROM (s.trial_ends_at - NOW())) / 86400.0 as days_remaining,
  COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) as diagnostics_completed,
  MAX(ds.completed_at) as last_diagnostic_completed
FROM auth.users u
JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN diagnostics_sessions ds ON u.id = ds.user_id
WHERE s.status = 'trialing'
  AND s.trial_ends_at > NOW()
  AND ds.completed_at IS NOT NULL
GROUP BY u.id, u.email, s.trial_ends_at
HAVING COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) > 0
ORDER BY diagnostics_completed DESC, days_remaining ASC;




