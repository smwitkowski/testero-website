# PMLE Question Migration Guide

**Purpose:** This document describes how to migrate legacy PMLE questions from JSON files into the canonical schema.

**Last Updated:** January 2025

---

## Overview

The migration script (`python-api/scripts/migrate_pmle_questions.py`) transforms legacy PMLE question data into the canonical schema:

- **Input:** Legacy JSON files with PMLE questions (e.g., `google_ml_engineer_questions_*.json`)
- **Output:** Data in canonical tables (`exam_domains`, `questions`, `answers`, `explanations`)

---

## Prerequisites

1. **Supabase credentials** set as environment variables:
   ```bash
   export SUPABASE_URL='https://your-project.supabase.co'
   export SUPABASE_SERVICE_KEY='your-service-key'
   ```

2. **Canonical schema** must be created in Supabase (run migration `20251119162319_create_pmle_canonical_schema.sql`)

3. **Python dependencies** installed:
   ```bash
   pip install supabase
   ```

---

## Usage

### Basic Usage

```bash
# Full migration
python python-api/scripts/migrate_pmle_questions.py python-api/google_ml_engineer_questions_20250816_171635.json

# Pilot run (30-50 questions)
python python-api/scripts/migrate_pmle_questions.py python-api/google_ml_engineer_questions_20250816_171635.json --pilot

# Dry run (validate without writing)
python python-api/scripts/migrate_pmle_questions.py python-api/google_ml_engineer_questions_20250816_171635.json --dry-run

# Custom limit
python python-api/scripts/migrate_pmle_questions.py python-api/google_ml_engineer_questions_20250816_171635.json --limit 30
```

### Command-Line Options

- `json_file` (required): Path to legacy JSON file
- `--pilot`: Run in pilot mode (limits to 50 questions)
- `--dry-run`: Validate and log without writing to database
- `--limit N`: Migrate only first N questions

---

## Migration Process

### Step 1: Pilot Migration (30-50 questions)

**Goal:** Validate the migration script and schema with a small sample.

```bash
python python-api/scripts/migrate_pmle_questions.py \
  python-api/google_ml_engineer_questions_20250816_171635.json \
  --pilot --limit 50
```

**What to check:**
1. Review logs for skipped questions and reasons
2. Verify data in Supabase:
   - Questions show correct stems and domains
   - Answers show exactly one correct option per question
   - Explanations are present and attached
3. Manual spot-check 10-15 questions for quality

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

### Step 2: Fix Issues (if any)

If pilot run reveals issues:
1. Fix migration script logic if needed
2. Document any data quality issues for follow-up tickets
3. Re-run pilot to confirm fixes

### Step 3: Full Migration

Once pilot is validated, run full migration:

```bash
python python-api/scripts/migrate_pmle_questions.py \
  python-api/google_ml_engineer_questions_20250816_171635.json
```

**Expected output:**
```
Migration Summary
==================
Total processed: 150
Successful: 145
Skipped: 5
Errors: 0

Skip reasons:
  Missing correct_explanation: 3
  Too few options: 2
```

### Step 4: Validation Queries

After migration, run SQL checks:

```sql
-- Questions with no explanations
SELECT q.id, q.stem
FROM questions q
LEFT JOIN explanations e ON q.id = e.question_id
WHERE e.id IS NULL;

-- Questions with 0 or >1 correct answers
SELECT q.id, q.stem, COUNT(a.id) as correct_count
FROM questions q
LEFT JOIN answers a ON q.id = a.question_id AND a.is_correct = true
GROUP BY q.id, q.stem
HAVING COUNT(a.id) != 1;

-- Questions by domain
SELECT ed.name, COUNT(q.id) as question_count
FROM exam_domains ed
LEFT JOIN questions q ON ed.id = q.domain_id
GROUP BY ed.name
ORDER BY question_count DESC;
```

---

## Data Mapping

### Legacy Format → Canonical Schema

| Legacy Field | Canonical Table | Canonical Field | Notes |
|-------------|----------------|-----------------|-------|
| `topic` | `exam_domains` | `code`, `name` | Topic becomes domain code (uppercase) |
| `id` | `questions` | `id` | UUID preserved |
| `stem` | `questions` | `stem` | Direct mapping |
| `difficulty` | `questions` | `difficulty` | Mapped: beginner→EASY, intermediate→MEDIUM, advanced→HARD |
| `options[]` | `answers` | Multiple rows | Each option becomes an answer row |
| `options[].label` | `answers` | `choice_label` | Direct mapping (A, B, C, D) |
| `options[].text` | `answers` | `choice_text` | Direct mapping |
| `options[].is_correct` | `answers` | `is_correct` | Direct mapping |
| `explanation.correct_explanation` | `explanations` | `explanation_text` | Combined with distractors |
| `explanation.distractor_explanations[]` | `explanations` | `explanation_text` | Appended to correct explanation |

### Domain Code Generation

Topics are converted to domain codes:
- `"BigQuery ML for classification and regression"` → `"BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION"`
- `"AutoML for tabular, text, and image data"` → `"AUTOML_FOR_TABULAR_TEXT_AND_IMAGE_DATA"`

---

## Validation Rules

Questions are **skipped** if they fail any of these checks:

1. ✅ **Has stem** - Question text must be present
2. ✅ **Has 2-5 options** - Must have at least 2, at most 5 answer choices
3. ✅ **Exactly one correct answer** - One and only one option must have `is_correct = true`
4. ✅ **Has explanation** - Must have `explanation.correct_explanation`
5. ✅ **Has topic** - Must have a topic for domain mapping

---

## Error Handling

### Common Skip Reasons

- **"Missing stem"**: Question has no question text
- **"Too few options"**: Less than 2 answer choices
- **"Too many options"**: More than 5 answer choices
- **"No correct answer found"**: No option marked as correct
- **"Multiple correct answers"**: More than one option marked as correct
- **"Missing correct_explanation"**: Explanation object missing or empty
- **"Missing topic"**: No topic field for domain mapping

### Error Recovery

If errors occur:
1. Check logs for specific question IDs
2. Review source JSON for data quality issues
3. Fix migration script if logic error
4. Re-run migration (script is idempotent for domains, but questions will duplicate)

---

## Assumptions and Limitations

### Assumptions

1. **Exam code**: All questions are assumed to be for `GCP_PM_ML_ENG` exam
2. **Status**: All migrated questions are set to `ACTIVE`
3. **Source reference**: `source_ref` is set to NULL (can be populated later)
4. **Domain creation**: Domains are auto-created from topics if they don't exist

### Limitations

1. **Idempotency**: Running migration twice will create duplicate questions (domains are idempotent)
2. **Explanation format**: Legacy `distractor_explanations` are concatenated into single text
3. **Domain mapping**: Topic → domain code conversion is automatic and may need manual review
4. **Dry run**: Dry run mode doesn't validate foreign key constraints (domains don't exist)

---

## Post-Migration Tasks

After successful migration:

1. **Run QA SQL checks** (see Step 4 above)
2. **Review domain codes** - Verify auto-generated codes are appropriate
3. **Manual QA pass** - Review 20-30 random questions for quality
4. **Update source_ref** - Populate `source_ref` fields if needed
5. **Set difficulty** - Review and adjust difficulty levels if needed

---

## Troubleshooting

### "Failed to create domain"

**Cause:** Domain code conflict or database error  
**Fix:** Check Supabase logs, verify domain code uniqueness

### "No correct answer found"

**Cause:** Legacy data has no `is_correct: true` option  
**Fix:** Review source JSON, fix data quality issue

### "Multiple correct answers"

**Cause:** Legacy data has multiple `is_correct: true` options  
**Fix:** Review source JSON, decide which is correct, fix data

### Connection errors

**Cause:** Invalid Supabase credentials or network issue  
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables

---

## Next Steps

After migration is complete:

1. ✅ Run pilot migration (TES-362)
2. ✅ Run full migration (TES-363)
3. ✅ Run QA SQL checks (TES-363)
4. ✅ Manual QA pass (TES-364)
5. ✅ Define quality rubric (TES-364)

