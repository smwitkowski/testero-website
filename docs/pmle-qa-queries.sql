-- PMLE Question Integrity QA Queries
-- These queries help validate data quality after migration
-- Run these after migrating questions to check for structural issues

-- ============================================================================
-- 1. Questions with no explanations
-- ============================================================================
-- Expected: 0 rows (all questions should have explanations)
SELECT 
    q.id,
    q.stem,
    q.exam,
    q.created_at
FROM questions q
LEFT JOIN explanations e ON q.id = e.question_id
WHERE e.id IS NULL
ORDER BY q.created_at DESC;

-- ============================================================================
-- 2. Questions with 0 or >1 correct answers
-- ============================================================================
-- Expected: 0 rows (each question should have exactly 1 correct answer)
SELECT 
    q.id,
    q.stem,
    COUNT(a.id) FILTER (WHERE a.is_correct = true) as correct_count,
    COUNT(a.id) as total_answers
FROM questions q
LEFT JOIN answers a ON q.id = a.question_id
GROUP BY q.id, q.stem
HAVING COUNT(a.id) FILTER (WHERE a.is_correct = true) != 1
ORDER BY correct_count DESC, q.created_at DESC;

-- ============================================================================
-- 3. Questions with too few or too many answer options
-- ============================================================================
-- Expected: 0 rows (each question should have 3-5 answers)
SELECT 
    q.id,
    q.stem,
    COUNT(a.id) as answer_count
FROM questions q
LEFT JOIN answers a ON q.id = a.question_id
GROUP BY q.id, q.stem
HAVING COUNT(a.id) < 3 OR COUNT(a.id) > 5
ORDER BY answer_count DESC;

-- ============================================================================
-- 4. Questions by domain (coverage check)
-- ============================================================================
-- Use this to verify questions are distributed across domains
SELECT 
    ed.code,
    ed.name,
    COUNT(q.id) as question_count,
    COUNT(DISTINCT q.difficulty) as difficulty_levels,
    COUNT(DISTINCT CASE WHEN q.status = 'ACTIVE' THEN q.id END) as active_count
FROM exam_domains ed
LEFT JOIN questions q ON ed.id = q.domain_id
GROUP BY ed.id, ed.code, ed.name
ORDER BY question_count DESC;

-- ============================================================================
-- 5. Questions by difficulty distribution
-- ============================================================================
-- Use this to check difficulty distribution
SELECT 
    COALESCE(q.difficulty, 'NULL') as difficulty,
    COUNT(q.id) as question_count,
    ROUND(100.0 * COUNT(q.id) / SUM(COUNT(q.id)) OVER (), 2) as percentage
FROM questions q
GROUP BY q.difficulty
ORDER BY 
    CASE q.difficulty
        WHEN 'EASY' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'HARD' THEN 3
        ELSE 4
    END;

-- ============================================================================
-- 6. Questions by status
-- ============================================================================
-- Use this to check status distribution
SELECT 
    COALESCE(q.status, 'NULL') as status,
    COUNT(q.id) as question_count
FROM questions q
GROUP BY q.status
ORDER BY question_count DESC;

-- ============================================================================
-- 7. Random sample of questions by domain (for manual QA)
-- ============================================================================
-- Use this to get a random sample for manual review
SELECT 
    q.id,
    q.stem,
    ed.name as domain,
    q.difficulty,
    q.status,
    COUNT(a.id) as answer_count,
    COUNT(a.id) FILTER (WHERE a.is_correct = true) as correct_answer_count,
    CASE WHEN e.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_explanation
FROM questions q
JOIN exam_domains ed ON q.domain_id = ed.id
LEFT JOIN answers a ON q.id = a.question_id
LEFT JOIN explanations e ON q.id = e.question_id
GROUP BY q.id, q.stem, ed.name, q.difficulty, q.status, e.id
ORDER BY RANDOM()
LIMIT 20;

-- ============================================================================
-- 8. Questions with duplicate choice labels
-- ============================================================================
-- Expected: 0 rows (each question's answer labels should be unique)
SELECT 
    q.id,
    q.stem,
    a.choice_label,
    COUNT(*) as label_count
FROM questions q
JOIN answers a ON q.id = a.question_id
GROUP BY q.id, q.stem, a.choice_label
HAVING COUNT(*) > 1
ORDER BY q.id, a.choice_label;

-- ============================================================================
-- 9. Questions missing required fields
-- ============================================================================
-- Expected: 0 rows (all questions should have required fields)
SELECT 
    q.id,
    q.stem,
    CASE 
        WHEN q.stem IS NULL OR q.stem = '' THEN 'Missing stem'
        WHEN q.exam IS NULL OR q.exam = '' THEN 'Missing exam'
        WHEN q.domain_id IS NULL THEN 'Missing domain_id'
        ELSE 'OK'
    END as issue
FROM questions q
WHERE q.stem IS NULL OR q.stem = '' 
   OR q.exam IS NULL OR q.exam = ''
   OR q.domain_id IS NULL;

-- ============================================================================
-- 10. Migration summary statistics
-- ============================================================================
-- Use this to get overall migration statistics
SELECT 
    'Total Questions' as metric,
    COUNT(*)::text as value
FROM questions
UNION ALL
SELECT 
    'Questions with Explanations',
    COUNT(*)::text
FROM questions q
JOIN explanations e ON q.id = e.question_id
UNION ALL
SELECT 
    'Total Answers',
    COUNT(*)::text
FROM answers
UNION ALL
SELECT 
    'Correct Answers',
    COUNT(*)::text
FROM answers
WHERE is_correct = true
UNION ALL
SELECT 
    'Total Domains',
    COUNT(*)::text
FROM exam_domains
UNION ALL
SELECT 
    'Active Questions',
    COUNT(*)::text
FROM questions
WHERE status = 'ACTIVE'
UNION ALL
SELECT 
    'Questions by Exam: ' || exam,
    COUNT(*)::text
FROM questions
GROUP BY exam;

-- ============================================================================
-- 11. Questions with empty or very short explanations
-- ============================================================================
-- Use this to find explanations that might need improvement
SELECT 
    q.id,
    q.stem,
    LENGTH(e.explanation_text) as explanation_length,
    LEFT(e.explanation_text, 100) as explanation_preview
FROM questions q
JOIN explanations e ON q.id = e.question_id
WHERE LENGTH(e.explanation_text) < 50
ORDER BY explanation_length;

-- ============================================================================
-- 12. Answer options with empty text
-- ============================================================================
-- Expected: 0 rows (all answers should have text)
SELECT 
    a.id,
    q.id as question_id,
    q.stem,
    a.choice_label,
    a.choice_text,
    a.is_correct
FROM answers a
JOIN questions q ON a.question_id = q.id
WHERE a.choice_text IS NULL OR a.choice_text = ''
ORDER BY q.id, a.choice_label;

