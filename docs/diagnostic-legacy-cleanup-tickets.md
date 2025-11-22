# Diagnostic/Legacy Cleanup - Linear Ticket Descriptions

**Purpose:** This document contains ready-to-copy Linear ticket descriptions for migrating diagnostics from legacy question tables to the canonical schema.

**Status:** Follow-up work for Week 2+ (not blocking Week 1 completion)

---

## Ticket 1: Migrate Diagnostic Pools from questions_legacy → Canonical Questions

### Title
`Migrate diagnostic question pools to use canonical questions schema`

### Description

**Current State:**
- Diagnostic API (`/api/diagnostic`) currently queries from legacy `questions` table structure
- Legacy table uses `exam_version_id`, `is_diagnostic_eligible`, and references `options` table
- Diagnostic sessions snapshot questions into `diagnostic_questions` table (JSONB format)
- Legacy `questions_legacy` table still exists with 89 questions

**Problem:**
- Diagnostics are still dependent on legacy schema
- Canonical schema (`questions`, `answers`, `explanations`, `exam_domains`) has 114 PMLE questions ready
- Two separate question systems create maintenance burden and potential inconsistencies

**Required Changes:**
1. Update diagnostic API to query from canonical `questions` table instead of legacy
2. Map canonical schema fields to diagnostic requirements:
   - `questions.exam` → filter by exam type (e.g., "GCP_PM_ML_ENG")
   - `questions.status = 'ACTIVE'` → equivalent to `is_diagnostic_eligible = true`
   - `questions.domain_id` → can be used for domain-based diagnostic pools
   - Join `answers` table to get answer options
   - Join `explanations` table for explanations (if needed)
3. Update diagnostic question selection logic to work with canonical schema
4. Ensure backward compatibility with existing diagnostic sessions

**Files to Modify:**
- `frontend/app/api/diagnostic/route.ts` - Update question fetching logic
- `frontend/app/api/diagnostic/session/route.ts` - Update session creation logic
- Any diagnostic-related queries or utilities

**Acceptance Criteria:**
- [ ] Diagnostic API queries canonical `questions` table instead of legacy
- [ ] Diagnostic sessions can be created using canonical questions
- [ ] Existing diagnostic sessions continue to work (backward compatible)
- [ ] Diagnostic question selection respects `status = 'ACTIVE'` filter
- [ ] Questions are properly mapped from canonical schema to diagnostic snapshot format
- [ ] All tests pass
- [ ] Manual test: Create new diagnostic session and verify questions load correctly

**Estimated Effort:** 2-3 hours

**Dependencies:** None (can start immediately after Week 1)

---

## Ticket 2: Refactor diagnostic_questions to Reference Canonical Questions

### Title
`Refactor diagnostic_questions table to reference canonical questions schema`

### Description

**Current State:**
- `diagnostic_questions` table stores question snapshots as JSONB
- Has nullable `question_id` field (currently used for AI-generated questions)
- Snapshots include `stem`, `options` (JSONB), and `correct_label`
- Diagnostic sessions are immutable snapshots (good design)

**Problem:**
- `question_id` field could reference canonical questions but currently doesn't
- No clear link between diagnostic snapshots and canonical question source
- Hard to track which canonical questions are used in diagnostics

**Required Changes:**
1. Update `diagnostic_questions.question_id` to reference canonical `questions.id`
2. Ensure diagnostic session creation populates `question_id` when creating snapshots
3. Add foreign key constraint: `question_id REFERENCES questions(id) ON DELETE SET NULL`
4. Update any code that creates diagnostic questions to set `question_id`
5. Consider adding index on `question_id` for analytics/queries

**Migration Steps:**
1. Add foreign key constraint (if not already present)
2. Backfill `question_id` for existing diagnostic questions (if possible to match)
3. Update diagnostic creation code to always set `question_id`
4. Add validation to ensure `question_id` is set for canonical questions

**Files to Modify:**
- `frontend/supabase/migrations/` - Add migration for foreign key constraint
- `frontend/app/api/diagnostic/route.ts` - Update to set `question_id` when creating snapshots
- `frontend/app/api/diagnostic/session/route.ts` - Update session creation logic

**Acceptance Criteria:**
- [ ] `diagnostic_questions.question_id` has foreign key to `questions.id`
- [ ] New diagnostic sessions populate `question_id` when creating snapshots
- [ ] Existing diagnostic sessions remain functional (backward compatible)
- [ ] Can query which canonical questions are used in diagnostics
- [ ] Migration script handles existing data gracefully

**Estimated Effort:** 1-2 hours

**Dependencies:** Ticket 1 (diagnostics must use canonical questions first)

---

## Ticket 3: Retire Legacy Question Tables

### Title
`Retire legacy question tables after diagnostics migration`

### Description

**Current State:**
- Legacy tables exist: `questions_legacy`, `options_legacy`, `explanations_legacy`
- Legacy tables contain 89 questions (per assessment)
- Canonical schema has 114 PMLE questions migrated
- Diagnostics still reference legacy (will be fixed in Tickets 1 & 2)

**Problem:**
- Legacy tables create confusion and maintenance overhead
- Risk of accidentally using wrong schema
- Database clutter

**Prerequisites:**
- ✅ Ticket 1 complete (diagnostics use canonical questions)
- ✅ Ticket 2 complete (diagnostic_questions references canonical)
- ✅ Verify no other code references legacy tables
- ✅ Backup legacy data (if needed for historical reference)

**Cleanup Steps:**
1. **Audit:** Search codebase for any references to legacy tables
   - `questions_legacy`
   - `options_legacy`
   - `explanations_legacy`
   - Any queries or code using these tables

2. **Backup (Optional):** Export legacy data to archive if needed
   ```sql
   -- Create archive tables or export to JSON/CSV
   CREATE TABLE questions_legacy_archive AS SELECT * FROM questions_legacy;
   ```

3. **Remove Foreign Key Dependencies:** Ensure no tables reference legacy tables

4. **Drop Tables:** Create migration to drop legacy tables
   ```sql
   DROP TABLE IF EXISTS options_legacy CASCADE;
   DROP TABLE IF EXISTS explanations_legacy CASCADE;
   DROP TABLE IF EXISTS questions_legacy CASCADE;
   ```

5. **Update Documentation:** Remove references to legacy tables from docs

**Files to Modify:**
- `frontend/supabase/migrations/` - Create migration to drop legacy tables
- Search and update any documentation referencing legacy tables
- Update database schema documentation

**Acceptance Criteria:**
- [ ] No code references legacy tables (verified via search)
- [ ] Diagnostics fully migrated to canonical schema (Tickets 1 & 2 complete)
- [ ] Legacy tables dropped via migration
- [ ] Documentation updated to remove legacy references
- [ ] Database is clean (only canonical schema remains)
- [ ] All tests pass

**Estimated Effort:** 1 hour

**Dependencies:** 
- Ticket 1 (diagnostics use canonical)
- Ticket 2 (diagnostic_questions references canonical)

---

## Implementation Order

1. **Ticket 1** → Migrate diagnostic pools (foundation)
2. **Ticket 2** → Refactor diagnostic_questions (builds on Ticket 1)
3. **Ticket 3** → Retire legacy tables (final cleanup, depends on 1 & 2)

---

## Notes

- **Week 1 Status:** Canonical schema is complete and structurally sound
- **Week 1 Status:** 114 PMLE questions migrated to canonical schema
- **Week 1 Status:** Legacy tables exist but are deprecated
- **Follow-up:** These tickets explicitly capture the diagnostic/legacy cleanup work
- **Timeline:** These are Week 2+ tasks, not blockers for Week 1 completion

---

## Related Documentation

- `frontend/docs/pmle-schema.md` - Canonical schema documentation
- `frontend/docs/pmle-migration.md` - Migration guide
- `frontend/docs/QUESTION_DATA_MODELS.md` - Current question data models
- `frontend/supabase/migrations/20251119162319_create_pmle_canonical_schema.sql` - Schema migration


