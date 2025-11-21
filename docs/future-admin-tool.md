# Future Admin Tool for Question Review (TES-366)

**Status:** Planned for future implementation  
**Priority:** Nice-to-have / Optional

---

## Overview

This ticket proposes building a separate tool (CLI or standalone web app) to help with PMLE question review and QA. The tool would provide a better UX than raw SQL queries for reviewing random questions and updating their status.

---

## Requirements

### Core Features

1. **Fetch Random Questions**
   - Get random PMLE questions for review
   - Filter by domain (optional)
   - Filter by difficulty (optional)
   - Filter by status (optional)

2. **Display Question Details**
   - Question stem (full text)
   - All answer choices with correct answer highlighted
   - Full explanation text
   - Domain and difficulty information
   - Current status

3. **Review Actions**
   - Mark question as `DRAFT` (needs review)
   - Mark question as `RETIRED` (deprecated)
   - Update question status to `ACTIVE`
   - Add review notes/reason for status change
   - Update domain mapping (if needed)
   - Update difficulty level (if needed)

4. **Review Tracking**
   - Track which questions have been reviewed
   - Save review notes/feedback
   - Export review results

### Optional Features

- Batch review mode (review multiple questions)
- Review history / audit log
- Quality score tracking
- Issue categorization (stem_unclear, distractor_poor, etc.)
- Export reviewed questions to CSV/JSON
- Integration with Linear/JIRA for issue tracking

---

## Implementation Options

### Option 1: CLI Tool (Recommended for simplicity)

**Pros:**
- Fast to build
- No UI complexity
- Easy to script/automate
- Can run locally or in CI/CD

**Example Usage:**
```bash
# Get random question for review
testero-review question random

# Review specific question
testero-review question <question-id>

# Update status
testero-review question <question-id> --status DRAFT --reason "explanation incomplete"

# Batch review 25 questions
testero-review batch --limit 25
```

**Tech Stack:**
- Node.js/TypeScript or Python
- Supabase client library
- Inquirer.js (CLI prompts) or click (Python CLI)

### Option 2: Standalone Web App

**Pros:**
- Better UX than CLI
- Can view questions formatted nicely
- Can bookmark/share specific questions

**Cons:**
- More complex to build/maintain
- Requires hosting/deployment

**Tech Stack:**
- Next.js or React SPA
- Supabase client
- Simple auth (admin key or internal only)

### Option 3: Simple Script/Notebook

**Pros:**
- Quickest to build
- Good for one-off reviews
- Easy to customize per reviewer

**Example:**
- Jupyter notebook with SQL queries
- Python script with interactive prompts
- Node.js script with inquirer prompts

---

## Design Considerations

### Authentication

- Simple admin key authentication
- Or use Supabase service role key (for admin access)
- No user accounts needed (internal tool only)

### Data Access

- Read from: `questions`, `answers`, `explanations`, `exam_domains`
- Write to: `questions` (status, domain_id, difficulty updates)
- Optional: Create `question_reviews` table for tracking review history

### Review Workflow

1. Fetch random question
2. Display question details
3. Reviewer applies quality rubric checklist
4. Reviewer marks status (DRAFT/ACTIVE/RETIRED)
5. Optional: Save review notes
6. Move to next question

---

## Acceptance Criteria

- [ ] Tool can fetch random PMLE questions from Supabase
- [ ] Tool displays full question details (stem, answers, explanation, metadata)
- [ ] Tool allows updating question status (ACTIVE/DRAFT/RETIRED)
- [ ] Tool allows adding review notes/reason for status change
- [ ] Tool can filter questions by domain/difficulty/status
- [ ] Tool provides clear instructions for reviewers
- [ ] Tool is easy to run (simple command or one-click launch)
- [ ] Tool integrates with existing QA workflow

---

## Current Workaround

Until this tool is built, use the SQL-based approach documented in:
- [`manual-qa-guide.md`](./manual-qa-guide.md) - Step-by-step QA process
- [`qa-review-template.md`](./qa-review-template.md) - Review checklist template
- [`pmle-qa-queries.sql`](./pmle-qa-queries.sql) - SQL queries for QA

---

## Future Enhancements

Once basic tool is built:
- Review analytics dashboard
- Quality metrics tracking
- Automated quality scoring
- Integration with question generation pipeline
- Bulk review operations
- Review assignment/queue system

