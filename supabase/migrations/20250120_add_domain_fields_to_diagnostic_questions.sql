-- Migration: Add domain fields to diagnostic_questions table
-- This migration adds domain_id and domain_code to diagnostic_questions to support
-- domain breakdown calculations without joining back to canonical questions table.
--
-- These fields are nullable to maintain backward compatibility with existing sessions.

-- Add domain_id column (nullable UUID, references exam_domains.id)
ALTER TABLE diagnostic_questions
ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES exam_domains(id) ON DELETE SET NULL;

-- Add domain_code column (nullable TEXT, stores exam_domains.code for quick lookups)
ALTER TABLE diagnostic_questions
ADD COLUMN IF NOT EXISTS domain_code TEXT;

-- Add index on domain_code for faster domain breakdown queries
CREATE INDEX IF NOT EXISTS diagnostic_questions_domain_code_idx ON diagnostic_questions(domain_code);

-- Add index on domain_id for joins if needed
CREATE INDEX IF NOT EXISTS diagnostic_questions_domain_id_idx ON diagnostic_questions(domain_id);

-- Add comment explaining the purpose of these fields
COMMENT ON COLUMN diagnostic_questions.domain_id IS 'Foreign key to exam_domains. Snapshot of domain at question creation time.';
COMMENT ON COLUMN diagnostic_questions.domain_code IS 'Domain code (exam_domains.code) snapshot for quick domain breakdown queries without joins.';

