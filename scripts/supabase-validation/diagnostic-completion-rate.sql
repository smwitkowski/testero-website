-- Validation Query: Diagnostic Completion Rate
-- Purpose: Compare PostHog diagnostic_started → diagnostic_completed funnel rates
-- Run this query and compare with PostHog Dashboard 2, Step 3.2

SELECT 
  DATE_TRUNC('day', started_at) as date,
  COUNT(*) FILTER (WHERE started_at IS NOT NULL) as started,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed_at IS NOT NULL) / 
        NULLIF(COUNT(*) FILTER (WHERE started_at IS NOT NULL), 0), 2) as completion_rate_pct
FROM diagnostics_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- Overall completion rate
SELECT 
  COUNT(*) FILTER (WHERE started_at IS NOT NULL) as total_started,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as total_completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed_at IS NOT NULL) / 
        NULLIF(COUNT(*) FILTER (WHERE started_at IS NOT NULL), 0), 2) as overall_completion_rate_pct
FROM diagnostics_sessions
WHERE started_at >= NOW() - INTERVAL '30 days';

-- Breakdown by exam type
SELECT 
  exam_type,
  COUNT(*) FILTER (WHERE started_at IS NOT NULL) as started,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed_at IS NOT NULL) / 
        NULLIF(COUNT(*) FILTER (WHERE started_at IS NOT NULL), 0), 2) as completion_rate_pct
FROM diagnostics_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY exam_type
ORDER BY completion_rate_pct DESC;

-- Breakdown by user type (anonymous vs authenticated)
SELECT 
  CASE 
    WHEN anonymous_session_id IS NOT NULL THEN 'anonymous'
    ELSE 'authenticated'
  END as user_type,
  COUNT(*) FILTER (WHERE started_at IS NOT NULL) as started,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed_at IS NOT NULL) / 
        NULLIF(COUNT(*) FILTER (WHERE started_at IS NOT NULL), 0), 2) as completion_rate_pct
FROM diagnostics_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY user_type
ORDER BY completion_rate_pct DESC;


