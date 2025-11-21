# Manual QA Pass Guide (TES-364)

**Purpose:** This guide helps perform a manual QA pass on migrated PMLE questions using the quality rubric and SQL queries.

**Goal:** Review a sample of 20-30 migrated questions and apply the quality rubric to ensure they meet standards.

---

## Overview

After running the full migration (TES-363), perform a manual QA pass to verify:
1. **Structural integrity** (already verified via SQL)
2. **Content quality** (requires human review)
3. **Domain accuracy** (requires domain knowledge)
4. **Difficulty appropriateness** (requires judgment)

---

## Step 1: Get Random Sample for Review

Run this SQL query in Supabase SQL Editor to get a random sample of 20-30 questions:

```sql
-- Get random sample of 25 questions for manual QA review
SELECT 
    q.id,
    q.stem,
    ed.code as domain_code,
    ed.name as domain_name,
    q.difficulty,
    q.status,
    COUNT(a.id) as answer_count,
    COUNT(a.id) FILTER (WHERE a.is_correct = true) as correct_count,
    CASE WHEN e.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_explanation,
    LENGTH(e.explanation_text) as explanation_length
FROM questions q
JOIN exam_domains ed ON q.domain_id = ed.id
LEFT JOIN answers a ON q.id = a.question_id
LEFT JOIN explanations e ON q.id = e.question_id
GROUP BY q.id, q.stem, ed.code, ed.name, q.difficulty, q.status, e.id, e.explanation_text
ORDER BY RANDOM()
LIMIT 25;
```

**Save the question IDs** from this query for detailed review.

---

## Step 2: Review Each Question Detail

For each question ID from Step 1, run this query to get full details:

```sql
-- Get full question details for review
-- Replace 'YOUR_QUESTION_ID_HERE' with actual question ID
SELECT 
    q.id,
    q.stem,
    q.difficulty,
    q.status,
    q.exam,
    ed.code as domain_code,
    ed.name as domain_name,
    json_agg(
        json_build_object(
            'label', a.choice_label,
            'text', a.choice_text,
            'is_correct', a.is_correct
        ) ORDER BY a.choice_label
    ) as answers,
    e.explanation_text,
    e.reasoning_style,
    e.doc_links,
    q.created_at,
    q.updated_at
FROM questions q
JOIN exam_domains ed ON q.domain_id = ed.id
LEFT JOIN answers a ON q.id = a.question_id
LEFT JOIN explanations e ON q.id = e.question_id
WHERE q.id = 'YOUR_QUESTION_ID_HERE'
GROUP BY q.id, q.stem, q.difficulty, q.status, q.exam, ed.code, ed.name, e.explanation_text, e.reasoning_style, e.doc_links, q.created_at, q.updated_at;
```

---

## Step 3: Apply Quality Rubric

For each question, check against the [PMLE Quality Rubric](../pmle-quality-rubric.md):

### ✅ Stem Quality Checklist
- [ ] **Clear scenario**: Presents realistic, work-relevant scenario
- [ ] **Specific context**: Includes relevant details (company type, data location, constraints)
- [ ] **Single focus**: Asks one clear question or requires one decision
- [ ] **Appropriate length**: 2-4 sentences (not too brief, not overly verbose)
- [ ] **Professional tone**: Uses industry-standard terminology
- [ ] **No giveaways**: Doesn't hint at the correct answer
- [ ] **Realistic**: Scenario could occur in real ML engineering work
- [ ] **Relevant**: Tests knowledge relevant to PMLE certification objectives

### ✅ Answer Set Quality Checklist
- [ ] **3-5 answer options**: Standard is 4 options (A, B, C, D)
- [ ] **Exactly one correct**: Only one option marked `is_correct = true`
- [ ] **Plausible distractors**: Wrong answers are believable and test understanding
- [ ] **Similar length**: Options are roughly similar in length
- [ ] **No patterns**: Correct answers distributed across positions
- [ ] **Non-empty text**: All options have meaningful content

### ✅ Explanation Quality Checklist
- [ ] **Comprehensive**: > 50 characters (target: 200+ characters)
- [ ] **Explains correct answer**: Clearly explains why the correct answer is right
- [ ] **Covers key distractors**: Explains why main distractors are wrong
- [ ] **Technically accurate**: Uses correct terminology and concepts
- [ ] **Clear and concise**: Easy to understand, not overly verbose

### ✅ Domain & Difficulty Checklist
- [ ] **Domain mapping**: Question tests knowledge relevant to the assigned domain
- [ ] **Difficulty appropriate**: 
  - **EASY**: Basic recall or straightforward application
  - **MEDIUM**: Understanding and application in common scenarios
  - **HARD**: Deep understanding, edge cases, or complex scenarios
- [ ] **Distribution**: Check difficulty distribution is reasonable (20-30% EASY, 50-60% MEDIUM, 20-30% HARD)

---

## Step 4: Document Issues

### For Each Question Reviewed

**Option A: No Issues Found**
- Mark as reviewed
- Question can remain `ACTIVE`

**Option B: Minor Issues (Can Fix)**
- Document the issue type:
  - `stem_unclear` - Stem needs clarification
  - `distractor_poor` - One or more distractors are weak
  - `explanation_incomplete` - Explanation missing key points
  - `domain_mismatch` - Question doesn't fit the assigned domain
  - `difficulty_mismatch` - Difficulty level seems wrong

- **Option**: Mark as `DRAFT` for later fix:
  ```sql
  UPDATE questions 
  SET status = 'DRAFT', updated_at = NOW() 
  WHERE id = 'QUESTION_ID';
  ```

**Option C: Major Issues (Should Fix)**
- Document the issue:
  - `stem_ambiguous` - Unclear what's being asked
  - `no_correct_answer` - Correct answer is actually wrong
  - `explanation_wrong` - Explanation contradicts correct answer
  - `domain_wrong` - Completely wrong domain assignment

- **Mark as `DRAFT` immediately**:
  ```sql
  UPDATE questions 
  SET status = 'DRAFT', updated_at = NOW() 
  WHERE id = 'QUESTION_ID';
  ```

---

## Step 5: Track Review Progress

Create a simple tracking spreadsheet or document:

| Question ID | Domain | Difficulty | Status | Issues Found | Reviewer Notes |
|-------------|--------|------------|--------|--------------|----------------|
| abc-123 | BigQuery ML | MEDIUM | ACTIVE | None | Good quality |
| def-456 | AutoML | EASY | DRAFT | explanation_incomplete | Missing distractor explanations |
| ghi-789 | Dataflow | HARD | ACTIVE | None | Excellent |

---

## Step 6: Fix Issues (If Needed)

### Update Question Status
```sql
-- Mark question as DRAFT for review
UPDATE questions 
SET status = 'DRAFT', updated_at = NOW() 
WHERE id = 'QUESTION_ID';

-- Mark question as RETIRED (if it's fundamentally flawed)
UPDATE questions 
SET status = 'RETIRED', updated_at = NOW() 
WHERE id = 'QUESTION_ID';

-- Mark question as ACTIVE (after fixing)
UPDATE questions 
SET status = 'ACTIVE', updated_at = NOW() 
WHERE id = 'QUESTION_ID';
```

### Update Domain (if needed)
```sql
-- Update domain mapping
UPDATE questions 
SET domain_id = (
    SELECT id FROM exam_domains WHERE code = 'CORRECT_DOMAIN_CODE'
),
updated_at = NOW()
WHERE id = 'QUESTION_ID';
```

### Update Difficulty (if needed)
```sql
-- Update difficulty level
UPDATE questions 
SET difficulty = 'CORRECT_DIFFICULTY', updated_at = NOW() 
WHERE id = 'QUESTION_ID';
```

---

## Step 7: Review Statistics

After reviewing all questions, run these queries to check overall quality:

### Status Distribution
```sql
SELECT 
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM questions
GROUP BY status
ORDER BY count DESC;
```

### Difficulty Distribution
```sql
SELECT 
    COALESCE(difficulty, 'NULL') as difficulty,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM questions
WHERE status = 'ACTIVE'
GROUP BY difficulty
ORDER BY 
    CASE difficulty
        WHEN 'EASY' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'HARD' THEN 3
        ELSE 4
    END;
```

### Domain Coverage
```sql
SELECT 
    ed.code,
    ed.name,
    COUNT(q.id) FILTER (WHERE q.status = 'ACTIVE') as active_questions,
    COUNT(q.id) FILTER (WHERE q.status = 'DRAFT') as draft_questions,
    COUNT(q.id) as total_questions
FROM exam_domains ed
LEFT JOIN questions q ON ed.id = q.domain_id
GROUP BY ed.id, ed.code, ed.name
ORDER BY active_questions DESC;
```

---

## Step 8: Sign-off Criteria

Before marking TES-364 complete, verify:

- [ ] **25+ questions manually reviewed** (target: 20-30% of total migrated questions)
- [ ] **Quality rubric applied** to each reviewed question
- [ ] **Issues documented** (if any found)
- [ ] **Status updated** for questions with issues (marked as DRAFT)
- [ ] **Review statistics** checked (difficulty distribution, domain coverage)
- [ ] **Quality assessment**: 
  - At least 80% of reviewed questions meet quality standards
  - No more than 10% have major issues requiring retirement
  - Domain and difficulty mappings are mostly accurate

---

## Quick Reference: SQL Queries for Review

All QA queries are available in: [`pmle-qa-queries.sql`](./pmle-qa-queries.sql)

**Most useful queries for manual QA:**
1. **Random sample**: Get 25 random questions for review
2. **Full question details**: Get complete question with answers and explanation
3. **Status distribution**: Check overall status breakdown
4. **Difficulty distribution**: Verify difficulty levels are reasonable
5. **Domain coverage**: Ensure questions distributed across domains

---

## Notes

- **Time estimate**: ~5-10 minutes per question for thorough review
- **Total time**: ~2-4 hours for 25 questions
- **Focus areas**: Stem clarity, answer plausibility, explanation quality
- **Domain expertise**: May need Google Cloud PMLE knowledge to verify domain accuracy

---

## Next Steps After Manual QA

1. **Fix issues**: Update questions marked as DRAFT
2. **Retire bad questions**: Mark fundamentally flawed questions as RETIRED
3. **Document patterns**: Note common issues for future question generation
4. **Update rubric**: Refine quality rubric based on review findings
5. **Move to production**: Questions passing QA are ready for users

