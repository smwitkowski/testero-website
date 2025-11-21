-- PMLE Domain Validation Queries
-- 
-- These queries can be run in Supabase SQL editor to validate domain mappings
-- and check domain distribution for capacity planning.

-- 1. Check for PMLE questions without domain_id
SELECT 
    id,
    stem,
    exam,
    status,
    domain_id
FROM questions
WHERE exam = 'GCP_PM_ML_ENG'
  AND status = 'ACTIVE'
  AND domain_id IS NULL;

-- Expected result: 0 rows (all ACTIVE questions should have domain_id)

-- 2. Domain distribution for capacity planning
SELECT 
    d.code,
    d.name,
    COUNT(q.id) as question_count
FROM exam_domains d
LEFT JOIN questions q ON d.id = q.domain_id 
    AND q.exam = 'GCP_PM_ML_ENG' 
    AND q.status = 'ACTIVE'
GROUP BY d.code, d.name
ORDER BY question_count DESC, d.code;

-- This shows how many ACTIVE questions exist per domain
-- Useful for verifying we have enough questions for blueprint-weighted selection

-- 3. Total ACTIVE PMLE questions
SELECT 
    COUNT(*) as total_active_questions
FROM questions
WHERE exam = 'GCP_PM_ML_ENG'
  AND status = 'ACTIVE';

-- 4. Questions per domain (detailed view)
SELECT 
    d.code as domain_code,
    d.name as domain_name,
    COUNT(q.id) as question_count,
    COUNT(CASE WHEN q.difficulty = 'EASY' THEN 1 END) as easy_count,
    COUNT(CASE WHEN q.difficulty = 'MEDIUM' THEN 1 END) as medium_count,
    COUNT(CASE WHEN q.difficulty = 'HARD' THEN 1 END) as hard_count,
    COUNT(CASE WHEN q.difficulty IS NULL THEN 1 END) as no_difficulty_count
FROM exam_domains d
LEFT JOIN questions q ON d.id = q.domain_id 
    AND q.exam = 'GCP_PM_ML_ENG' 
    AND q.status = 'ACTIVE'
GROUP BY d.code, d.name
HAVING COUNT(q.id) > 0
ORDER BY question_count DESC;

-- 5. Verify all questions have valid domain references
SELECT 
    q.id,
    q.stem,
    q.domain_id,
    CASE 
        WHEN d.id IS NULL THEN 'INVALID'
        ELSE 'VALID'
    END as domain_status
FROM questions q
LEFT JOIN exam_domains d ON q.domain_id = d.id
WHERE q.exam = 'GCP_PM_ML_ENG'
  AND q.status = 'ACTIVE'
  AND (q.domain_id IS NULL OR d.id IS NULL);

-- Expected result: 0 rows (all domain_id values should reference valid exam_domains)

-- 6. Verify all ACTIVE PMLE questions are mapped to blueprint domains
SELECT 
    d.code,
    d.name,
    COUNT(q.id) as question_count
FROM exam_domains d
INNER JOIN questions q ON d.id = q.domain_id
WHERE q.exam = 'GCP_PM_ML_ENG'
  AND q.status = 'ACTIVE'
  AND d.code NOT IN (
    'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
    'COLLABORATING_TO_MANAGE_DATA_AND_MODELS',
    'SCALING_PROTOTYPES_INTO_ML_MODELS',
    'SERVING_AND_SCALING_MODELS',
    'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES',
    'MONITORING_ML_SOLUTIONS'
  )
GROUP BY d.code, d.name
ORDER BY question_count DESC;

-- Expected result: 0 rows (all ACTIVE questions should be mapped to blueprint domains)
-- If rows are returned, these are legacy domains that need to be backfilled

-- 7. Blueprint domain distribution (for Week 2 selection validation)
SELECT 
    d.code,
    d.name,
    COUNT(q.id) as question_count
FROM exam_domains d
LEFT JOIN questions q ON d.id = q.domain_id 
    AND q.exam = 'GCP_PM_ML_ENG' 
    AND q.status = 'ACTIVE'
WHERE d.code IN (
    'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
    'COLLABORATING_TO_MANAGE_DATA_AND_MODELS',
    'SCALING_PROTOTYPES_INTO_ML_MODELS',
    'SERVING_AND_SCALING_MODELS',
    'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES',
    'MONITORING_ML_SOLUTIONS'
)
GROUP BY d.code, d.name
ORDER BY d.code;

-- This shows the distribution of ACTIVE questions across the six blueprint domains
-- Useful for verifying domain-weighted selection has sufficient inventory

