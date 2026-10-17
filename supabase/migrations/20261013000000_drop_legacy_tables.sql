-- IRREVERSIBLE: requires the full backup in /Users/switkowski/Projects/Testero/backups/
-- (Oct 3 dump: 2026-10-03/) and backups/legacy-tables-pre-drop-2026-10-13.json.
-- Founder-approved cleanup (D-030). Verify both backups and the current schema
-- before applying; an unknown dependency aborts this transaction (no CASCADE).
-- Preserve every v2 baseline object, public.waitlist and public.waitlist_entries.
BEGIN;

-- Only this view depends on the legacy public tables in the Oct 3 schema.
DROP VIEW IF EXISTS public.diagnostic_questions_with_metadata;

-- These old RPC bodies reference legacy tables; no v2 caller uses them.
DROP FUNCTION IF EXISTS public.check_and_increment_practice_quota(UUID, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_diagnostic_questions_for_exam(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_diagnostic_session_progress(UUID);

-- Keep waitlist entries and converted_user_id values, but detach the reference
-- to the retired public.users table (not auth.users). No baseline FK is changed.
ALTER TABLE IF EXISTS public.waitlist_entries
  DROP CONSTRAINT IF EXISTS waitlist_entries_converted_user_id_fkey;

-- Child tables precede parents. Table-owned policies, indexes, constraints and
-- sequences are removed by DROP TABLE; no legacy-table triggers exist in the dump.
DROP TABLE IF EXISTS public.diagnostic_analytics;
DROP TABLE IF EXISTS public.diagnostic_responses;
DROP TABLE IF EXISTS public.diagnostic_pool_questions;
DROP TABLE IF EXISTS public.diagnostic_question_pools;
DROP TABLE IF EXISTS public.practice_responses;
DROP TABLE IF EXISTS public.practice_questions;
DROP TABLE IF EXISTS public.practice_sessions;
DROP TABLE IF EXISTS public.diagnostic_questions;
DROP TABLE IF EXISTS public.diagnostics_sessions;
DROP TABLE IF EXISTS public.practice_question_attempts_v2;
DROP TABLE IF EXISTS public.practice_attempts;
DROP TABLE IF EXISTS public.practice_quota_usage;
DROP TABLE IF EXISTS public.responses;
DROP TABLE IF EXISTS public.study_plan_items;
DROP TABLE IF EXISTS public.test_sessions;
DROP TABLE IF EXISTS public.embeddings;
DROP TABLE IF EXISTS public.options_legacy;
DROP TABLE IF EXISTS public.explanations_legacy;
DROP TABLE IF EXISTS public.questions_legacy;
DROP TABLE IF EXISTS public.sections;
DROP TABLE IF EXISTS public.exam_versions;
DROP TABLE IF EXISTS public.exams;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.admin_users;

-- Keep update_updated_at_column() and update_questions_updated_at: the canonical
-- public.questions table uses them. Keep the baseline-locked answer writer
-- upsert_question_answers(), archive/vecs tables and public.user_statistics.
COMMIT;
