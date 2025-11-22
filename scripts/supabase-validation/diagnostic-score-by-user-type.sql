-- Validation Query: Average Diagnostic Score by User Type
-- Purpose: Validate score calculations and compare anonymous vs authenticated users
-- Run this query and compare with PostHog Dashboard 2 metrics

SELECT 
  CASE 
    WHEN s.anonymous_session_id IS NOT NULL THEN 'anonymous'
    ELSE 'authenticated'
  END as user_type,
  s.exam_type,
  COUNT(DISTINCT s.id) as sessions,
  ROUND(AVG((
    SELECT COUNT(*) FILTER (WHERE dr.is_correct)::FLOAT / NULLIF(COUNT(*), 0) * 100
    FROM diagnostic_responses dr
    WHERE dr.session_id = s.id
  )), 2) as avg_score_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (
    SELECT COUNT(*) FILTER (WHERE dr.is_correct)::FLOAT / NULLIF(COUNT(*), 0) * 100
    FROM diagnostic_responses dr
    WHERE dr.session_id = s.id
  )), 2) as median_score_pct
FROM diagnostics_sessions s
WHERE s.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY user_type, s.exam_type
ORDER BY user_type, avg_score_pct DESC;


