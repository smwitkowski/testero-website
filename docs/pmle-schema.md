# PMLE Canonical Question Schema

**Purpose:** This document defines the canonical schema for PMLE (Professional Machine Learning Engineer) questions, answers, explanations, and domains. This schema is designed to be generic enough to extend to future exams while providing a solid foundation for exam mode, readiness features, and question management.

**Last Updated:** January 2025

---

## Overview

The canonical PMLE schema consists of four core tables:

1. **`exam_domains`** - Blueprint domains/topics for exams
2. **`questions`** - Question stems and metadata
3. **`answers`** - Answer choices for questions
4. **`explanations`** - Explanations linked to questions

---

## Table Definitions

### `exam_domains`

Stores exam blueprint domains (e.g., "Designing ML Pipelines", "Data Preprocessing").

| Column | Type | Constraints | Description |
|--------|------|-------------|------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the domain |
| `code` | TEXT | NOT NULL, UNIQUE | Domain code (e.g., "DATA_PIPELINES") |
| `name` | TEXT | NOT NULL | Human-readable name (e.g., "Designing ML Pipelines") |
| `description` | TEXT | NULL | Optional description of the domain |

**Relationships:**
- Referenced by `questions.domain_id` (many-to-one)

**Notes:**
- `code` should be uppercase with underscores (e.g., `DATA_PIPELINES`)
- `name` should be human-readable and match exam blueprint terminology

---

### `questions`

Stores question stems and metadata for PMLE and future exams.

| Column | Type | Constraints | Description |
|--------|------|-------------|------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the question |
| `exam` | TEXT | NOT NULL | Exam identifier (e.g., "GCP_PM_ML_ENG") |
| `domain_id` | UUID | FOREIGN KEY → `exam_domains.id` | Domain this question belongs to |
| `stem` | TEXT | NOT NULL | The question text/scenario |
| `difficulty` | TEXT | NULL | Difficulty level: "EASY", "MEDIUM", "HARD" (or NULL) |
| `source_ref` | TEXT | NULL | Reference to blueprint section or doc URL slug |
| `status` | TEXT | NULL | Status: "ACTIVE", "DRAFT", "RETIRED" (or NULL) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Relationships:**
- References `exam_domains` via `domain_id`
- Referenced by `answers.question_id` (one-to-many)
- Referenced by `explanations.question_id` (one-to-one)

**Indexes:**
- `questions_exam_idx` on `exam` (for filtering by exam)
- `questions_domain_id_idx` on `domain_id` (for filtering by domain)

**Notes:**
- `exam` field allows the schema to support multiple exams (PMLE now, others later)
- `stem` is the question text/scenario (preferred term over "question_text")
- `difficulty` and `status` are nullable to allow gradual population
- `source_ref` can reference exam blueprint sections or documentation URLs

---

### `answers`

Stores answer choices for questions. Each question should have 3-5 answer options, with exactly one marked as correct.

| Column | Type | Constraints | Description |
|--------|------|-------------|------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the answer |
| `question_id` | UUID | FOREIGN KEY → `questions.id`, NOT NULL | Question this answer belongs to |
| `choice_label` | TEXT | NOT NULL | Label for the choice (e.g., "A", "B", "C", "D") |
| `choice_text` | TEXT | NOT NULL | The answer option text |
| `is_correct` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether this is the correct answer |

**Relationships:**
- References `questions` via `question_id`

**Indexes:**
- `answers_question_id_idx` on `question_id` (for fetching all answers for a question)

**Constraints:**
- Each question must have exactly one answer with `is_correct = true`
- `choice_label` should be unique within a question (enforced at application level)

**Notes:**
- `choice_label` typically follows alphabetical convention (A, B, C, D, E)
- `is_correct` should be TRUE for exactly one answer per question
- Answers are ordered by `choice_label` for consistent display

---

### `explanations`

Stores explanations for questions. Each question should have exactly one explanation.

| Column | Type | Constraints | Description |
|--------|------|-------------|------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the explanation |
| `question_id` | UUID | FOREIGN KEY → `questions.id`, NOT NULL, UNIQUE | Question this explanation belongs to |
| `explanation_text` | TEXT | NOT NULL | The explanation text |
| `reasoning_style` | TEXT | NULL | Optional reasoning style (e.g., "SHORT_RATIONALE") |
| `doc_links` | JSONB | NULL | JSON array of URLs or document identifiers |

**Relationships:**
- References `questions` via `question_id` (one-to-one)

**Indexes:**
- `explanations_question_id_idx` on `question_id` (for quick lookups)

**Constraints:**
- `question_id` is UNIQUE (one explanation per question)
- `explanation_text` must be non-empty

**Notes:**
- `explanation_text` should explain why the correct answer is correct
- `doc_links` is a JSONB array: `["url1", "url2"]` or `[{"type": "blueprint", "ref": "section-1.2"}]`
- `reasoning_style` is optional and can be used for categorization

---

## Relationships Summary

```
exam_domains (1) ──< (many) questions (1) ──< (many) answers
                                    │
                                    │ (1)
                                    │
                                    v
                              explanations (1)
```

**Key Relationships:**
- One `exam_domain` can have many `questions`
- One `question` can have many `answers` (typically 3-5)
- One `question` has exactly one `explanation`

---

## Required vs Optional Fields

### Required Fields

**`exam_domains`:**
- `code` (required)
- `name` (required)

**`questions`:**
- `id` (auto-generated)
- `exam` (required)
- `domain_id` (required)
- `stem` (required)
- `created_at` (auto-generated)
- `updated_at` (auto-generated)

**`answers`:**
- `id` (auto-generated)
- `question_id` (required)
- `choice_label` (required)
- `choice_text` (required)
- `is_correct` (required, defaults to FALSE)

**`explanations`:**
- `id` (auto-generated)
- `question_id` (required, unique)
- `explanation_text` (required)

### Optional Fields

**`exam_domains`:**
- `description`

**`questions`:**
- `difficulty`
- `source_ref`
- `status`

**`answers`:**
- (all fields are required, but `is_correct` defaults to FALSE)

**`explanations`:**
- `reasoning_style`
- `doc_links`

---

## Data Integrity Rules

1. **One correct answer per question:** Each question must have exactly one answer with `is_correct = true`
2. **One explanation per question:** Each question should have exactly one explanation (enforced by UNIQUE constraint)
3. **Valid domain references:** All `questions.domain_id` must reference existing `exam_domains.id`
4. **Non-empty text fields:** `stem`, `choice_text`, and `explanation_text` must be non-empty
5. **Unique choice labels:** Within a question, `choice_label` values should be unique (A, B, C, D)

---

## Extensibility

This schema is designed to support:

- **Multiple exams:** The `exam` field allows storing questions for PMLE, DP-203, SA-Pro, etc.
- **Future question types:** The `status` field can be extended with new statuses
- **Rich explanations:** The `doc_links` JSONB field allows linking to external resources
- **Difficulty tracking:** The `difficulty` field supports filtering and analytics

---

## Migration Notes

- This schema creates **new canonical tables** separate from legacy question tables
- Legacy tables (`questions`, `options`, etc.) remain untouched and are marked as deprecated
- Future migrations can migrate data from legacy tables to canonical tables
- The canonical schema uses `stem` instead of `question_text` for consistency with educational testing terminology

---

## Example Data

### Example Domain
```sql
INSERT INTO exam_domains (id, code, name, description) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'DATA_PIPELINES', 'Designing ML Pipelines', 
 'Topics related to designing and implementing ML pipelines');
```

### Example Question
```sql
INSERT INTO questions (id, exam, domain_id, stem, difficulty, status) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'GCP_PM_ML_ENG', 
 '550e8400-e29b-41d4-a716-446655440000',
 'You are building a ML pipeline for customer churn prediction...',
 'MEDIUM', 'ACTIVE');
```

### Example Answers
```sql
INSERT INTO answers (id, question_id, choice_label, choice_text, is_correct) VALUES
('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'A', 'Option A text', false),
('880e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'B', 'Option B text', true),
('990e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'C', 'Option C text', false);
```

### Example Explanation
```sql
INSERT INTO explanations (id, question_id, explanation_text, doc_links) VALUES
('aa0e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000',
 'Option B is correct because...',
 '["https://cloud.google.com/docs/..."]'::jsonb);
```

