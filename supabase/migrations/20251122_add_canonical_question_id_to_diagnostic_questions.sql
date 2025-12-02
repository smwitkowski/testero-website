-- Migration: Add canonical_question_id to diagnostic_questions table
-- This migration adds a new UUID column to diagnostic_questions to correctly
-- reference canonical questions (which use UUID IDs).
-- The existing original_question_id (bigint) is retained for backward compatibility
-- with older diagnostic sessions.

ALTER TABLE diagnostic_questions
ADD COLUMN canonical_question_id UUID REFERENCES questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS diagnostic_questions_canonical_question_id_idx
ON diagnostic_questions(canonical_question_id);

COMMENT ON COLUMN diagnostic_questions.canonical_question_id IS 'Foreign key to canonical questions.id (UUID). Used for PMLE and future canonical diagnostics.';


