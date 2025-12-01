-- Validation Query: Question Drop-Off Patterns
-- Purpose: Identify where users drop off during diagnostic
-- Run this query and compare with PostHog Dashboard 2, Step 3.6

SELECT 
  dq.question_id,
  q.domain,
  COUNT(DISTINCT dq.session_id) as times_shown,
  COUNT(dr.id) as times_answered,
  ROUND(100.0 * COUNT(dr.id) / NULLIF(COUNT(DISTINCT dq.session_id), 0), 2) as answer_rate_pct
FROM diagnostic_questions dq
LEFT JOIN diagnostic_responses dr ON dq.id = dr.diagnostic_question_id
LEFT JOIN questions q ON dq.question_id = q.id
WHERE dq.created_at >= NOW() - INTERVAL '30 days'
GROUP BY dq.question_id, q.domain
HAVING COUNT(DISTINCT dq.session_id) >= 10
ORDER BY answer_rate_pct ASC
LIMIT 20;

-- Question number drop-off analysis
SELECT 
  dq.question_order as question_number,
  COUNT(DISTINCT dq.session_id) as sessions_reached,
  COUNT(dr.id) as times_answered,
  ROUND(100.0 * COUNT(dr.id) / NULLIF(COUNT(DISTINCT dq.session_id), 0), 2) as answer_rate_pct
FROM diagnostic_questions dq
LEFT JOIN diagnostic_responses dr ON dq.id = dr.diagnostic_question_id
WHERE dq.created_at >= NOW() - INTERVAL '30 days'
GROUP BY dq.question_order
ORDER BY question_number ASC;



