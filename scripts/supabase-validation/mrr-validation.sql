-- Validation Query: MRR Validation
-- Purpose: Compare PostHog payment_recurring_succeeded sum with database
-- Run this query and compare with PostHog Dashboard 3, Step 5.2

SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(DISTINCT user_id) as active_subscriptions,
  COUNT(*) as transaction_count,
  SUM(amount) / 100.0 as total_revenue_dollars,
  ROUND(AVG(amount) / 100.0, 2) as avg_transaction_dollars,
  ROUND(SUM(amount) / 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 2) as avg_revenue_per_user
FROM payment_history
WHERE status = 'succeeded'
  AND created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Current MRR (active subscriptions this month)
SELECT 
  COUNT(DISTINCT user_id) as active_subscribers,
  SUM(amount) / 100.0 as current_mrr_dollars
FROM payment_history
WHERE status = 'succeeded'
  AND created_at >= DATE_TRUNC('month', NOW());




