# Pilot Migration Checklist (TES-362)

**Purpose:** Step-by-step checklist for running the pilot migration of 30-50 PMLE questions.

**Status:** Ready to execute

---

## Prerequisites

- [x] Canonical schema created (`exam_domains`, `questions`, `answers`, `explanations`)
- [x] Migration script created (`python-api/scripts/migrate_pmle_questions.py`)
- [x] Legacy JSON files available
- [ ] `SUPABASE_SERVICE_KEY` environment variable set

---

## Step 1: Set Environment Variables

```bash
export SUPABASE_URL="https://qpjsgcdrgnoinnlxzeze.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key-here"
```

**Note:** Get the service key from Supabase Dashboard → Project Settings → API → `service_role` key (not `anon` key)

---

## Step 2: Verify Script Works (Dry Run)

```bash
cd /Users/switkowski/Projects/Testero/python-api
source .venv/bin/activate

# Test with dry-run first
python scripts/migrate_pmle_questions.py \
  google_ml_engineer_questions_20250816_171635.json \
  --dry-run \
  --limit 5
```

**Expected:** Should show 3 successful questions, 0 skipped, 0 errors

---

## Step 3: Run Pilot Migration (30-50 questions)

```bash
# Run pilot migration (limits to 50 questions)
python scripts/migrate_pmle_questions.py \
  google_ml_engineer_questions_20250816_171635.json \
  --pilot
```

**Expected output:**
```
Migration Summary
==================
Total processed: 50
Successful: 48
Skipped: 2
Errors: 0

Skip reasons:
  Missing correct_explanation: 1
  Too few options: 1
```

---

## Step 4: Verify Data in Supabase

### 4.1 Check Questions Were Created

Run in Supabase SQL Editor:

```sql
SELECT 
    COUNT(*) as total_questions,
    COUNT(DISTINCT domain_id) as domains_used,
    COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_questions
FROM questions;
```

**Expected:** Should show ~48 questions, multiple domains, all ACTIVE

### 4.2 Check Answers Were Created

```sql
SELECT 
    COUNT(*) as total_answers,
    COUNT(*) FILTER (WHERE is_correct = true) as correct_answers,
    COUNT(DISTINCT question_id) as questions_with_answers
FROM answers;
```

**Expected:** 
- Total answers: ~192 (48 questions × 4 answers)
- Correct answers: ~48 (one per question)
- Questions with answers: ~48

### 4.3 Check Explanations Were Created

```sql
SELECT 
    COUNT(*) as total_explanations,
    AVG(LENGTH(explanation_text)) as avg_explanation_length
FROM explanations;
```

**Expected:** 
- Total explanations: ~48 (one per question)
- Avg length: > 200 characters

### 4.4 Check Domains Were Created

```sql
SELECT 
    code,
    name,
    (SELECT COUNT(*) FROM questions WHERE domain_id = ed.id) as question_count
FROM exam_domains ed
ORDER BY question_count DESC;
```

**Expected:** Should show 2-3 domains with questions distributed

---

## Step 5: Run QA SQL Checks

Run the queries from `frontend/docs/pmle-qa-queries.sql`:

### 5.1 Questions with no explanations
**Expected:** 0 rows

### 5.2 Questions with 0 or >1 correct answers
**Expected:** 0 rows

### 5.3 Questions with too few/many options
**Expected:** 0 rows

### 5.4 Migration summary statistics
**Expected:** Should match the migration script output

---

## Step 6: Manual Spot Check (10-15 questions)

### 6.1 Get Random Sample

```sql
SELECT 
    q.id,
    q.stem,
    ed.name as domain,
    q.difficulty,
    COUNT(a.id) as answer_count,
    COUNT(a.id) FILTER (WHERE a.is_correct = true) as correct_count
FROM questions q
JOIN exam_domains ed ON q.domain_id = ed.id
LEFT JOIN answers a ON q.id = a.question_id
GROUP BY q.id, q.stem, ed.name, q.difficulty
ORDER BY RANDOM()
LIMIT 15;
```

### 6.2 Review Each Question

For each question ID, check:

- [ ] Stem is clear and realistic
- [ ] Has 3-5 answer options
- [ ] Exactly one correct answer
- [ ] Distractors are plausible
- [ ] Explanation is comprehensive (> 50 chars)
- [ ] Explanation explains correct answer
- [ ] Domain mapping is correct
- [ ] Difficulty level seems appropriate

### 6.3 View Full Question Details

```sql
-- Get question with answers and explanation
SELECT 
    q.id,
    q.stem,
    q.difficulty,
    ed.name as domain,
    json_agg(
        json_build_object(
            'label', a.choice_label,
            'text', a.choice_text,
            'is_correct', a.is_correct
        ) ORDER BY a.choice_label
    ) as answers,
    e.explanation_text
FROM questions q
JOIN exam_domains ed ON q.domain_id = ed.id
LEFT JOIN answers a ON q.id = a.question_id
LEFT JOIN explanations e ON q.id = e.question_id
WHERE q.id = 'YOUR_QUESTION_ID_HERE'
GROUP BY q.id, q.stem, q.difficulty, ed.name, e.explanation_text;
```

---

## Step 7: Document Issues

If any issues are found:

1. **Structural issues** (no explanation, wrong answer count):
   - Note question ID and issue
   - These should be fixed in migration script or source data

2. **Quality issues** (poor stem, bad distractors):
   - Note question ID and issue type
   - Mark question as `DRAFT` for review:
     ```sql
     UPDATE questions SET status = 'DRAFT' WHERE id = 'QUESTION_ID';
     ```

3. **Domain mapping issues**:
   - Note question ID and correct domain
   - Update domain_id if needed:
     ```sql
     UPDATE questions 
     SET domain_id = (SELECT id FROM exam_domains WHERE code = 'CORRECT_CODE')
     WHERE id = 'QUESTION_ID';
     ```

---

## Step 8: Sign-off Criteria

Before proceeding to full migration (TES-363), verify:

- [ ] Pilot migration completed successfully
- [ ] All QA SQL checks pass (0 structural issues)
- [ ] Manual spot-check of 10-15 questions shows good quality
- [ ] Any issues found are documented and addressed
- [ ] Migration script logs are reviewed
- [ ] Data looks ready for full migration

---

## Next Steps

Once pilot migration is validated:

1. **TES-363**: Run full PMLE migration
2. **TES-364**: Manual QA pass and quality rubric application
3. **TES-365**: Add reusable QA SQL snippets (already done)
4. **TES-366**: Build admin view for question review (optional)

---

## Troubleshooting

### Migration script fails with authentication error
- Verify `SUPABASE_SERVICE_KEY` is set (not `SUPABASE_ANON_KEY`)
- Check service key has proper permissions

### Questions created but no answers/explanations
- Check migration script logs for errors
- Verify foreign key constraints are working
- Check if questions were skipped during validation

### Domain codes look wrong
- Review domain code generation logic in migration script
- Manually update domain codes if needed:
  ```sql
  UPDATE exam_domains SET code = 'CORRECT_CODE' WHERE code = 'WRONG_CODE';
  ```

