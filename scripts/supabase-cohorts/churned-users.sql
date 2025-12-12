-- Cohort: Churned Users
-- Purpose: Recently churned users for win-back campaigns
-- Export: CSV with columns: user_id, email, churned_at, customer_lifetime_days
-- PostHog Import: Use for churn analysis in Dashboard 3

SELECT DISTINCT 
  u.id as user_id, 
  u.email, 
  s.updated_at as churned_at,
  s.stripe_subscription_id,
  EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) / 86400.0 as customer_lifetime_days,
  s.plan_id,
  COUNT(ds.id) FILTER (WHERE ds.completed_at IS NOT NULL) as total_diagnostics_completed
FROM auth.users u
JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN diagnostics_sessions ds ON u.id = ds.user_id
WHERE s.status = 'canceled'
  AND s.updated_at >= NOW() - INTERVAL '90 days'
GROUP BY u.id, u.email, s.updated_at, s.stripe_subscription_id, s.created_at, s.plan_id
ORDER BY churned_at DESC;




