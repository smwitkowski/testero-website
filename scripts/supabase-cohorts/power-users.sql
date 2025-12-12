-- Cohort: Power Users
-- Purpose: Users with 2+ completed diagnostics in last 30 days
-- Export: CSV with columns: user_id, diagnostic_count, last_completed
-- PostHog Import: Use for engagement analysis in Dashboard 2

SELECT DISTINCT 
  ds.user_id,
  COUNT(DISTINCT ds.id) as diagnostic_count,
  MAX(ds.completed_at) as last_completed,
  STRING_AGG(DISTINCT ds.exam_type, ', ') as exam_types
FROM diagnostics_sessions ds
WHERE ds.completed_at IS NOT NULL
  AND ds.completed_at >= NOW() - INTERVAL '30 days'
  AND ds.user_id IS NOT NULL
GROUP BY ds.user_id
HAVING COUNT(DISTINCT ds.id) >= 2
ORDER BY diagnostic_count DESC, last_completed DESC;




