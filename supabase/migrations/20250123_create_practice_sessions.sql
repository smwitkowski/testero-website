-- Migration: Create practice_sessions and practice_questions tables
-- These tables support domain-targeted practice sessions (e.g., 10-question sets)
-- based on weak domains from diagnostic results.
--
-- Pattern mirrors diagnostics_sessions/diagnostic_questions snapshot approach
-- but simplified for authenticated users only (no anonymous session support).

-- Create practice_sessions table
CREATE TABLE practice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam TEXT NOT NULL, -- Exam identifier (e.g., 'pmle', 'GCP_PM_ML_ENG')
    exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL, -- Optional FK to exams table
    source TEXT NOT NULL DEFAULT 'study_plan_domain', -- e.g., 'from_diagnostic', 'study_plan_domain'
    source_session_id UUID REFERENCES diagnostics_sessions(id) ON DELETE SET NULL, -- Optional link to originating diagnostic
    question_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create practice_questions table (snapshot pattern like diagnostic_questions)
CREATE TABLE practice_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    canonical_question_id UUID REFERENCES questions(id) ON DELETE SET NULL, -- FK to canonical questions
    stem TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of { label: string, text: string }
    correct_label TEXT NOT NULL, -- The label of the correct option (e.g., "B")
    domain_code TEXT, -- Domain code snapshot for quick domain breakdown queries
    domain_id UUID REFERENCES exam_domains(id) ON DELETE SET NULL -- Optional FK to exam_domains
);

-- Create indexes for performance
CREATE INDEX practice_sessions_user_id_idx ON practice_sessions(user_id);
CREATE INDEX practice_sessions_created_at_idx ON practice_sessions(created_at DESC);
CREATE INDEX practice_sessions_source_session_id_idx ON practice_sessions(source_session_id) WHERE source_session_id IS NOT NULL;

CREATE INDEX practice_questions_session_id_idx ON practice_questions(session_id);
CREATE INDEX practice_questions_canonical_question_id_idx ON practice_questions(canonical_question_id) WHERE canonical_question_id IS NOT NULL;
CREATE INDEX practice_questions_domain_code_idx ON practice_questions(domain_code) WHERE domain_code IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE practice_sessions IS 'Practice sessions for domain-targeted question sets (e.g., 10-question practice sessions based on weak diagnostic domains)';
COMMENT ON TABLE practice_questions IS 'Snapshotted practice questions linked to practice sessions. Mirrors diagnostic_questions pattern for consistency.';
COMMENT ON COLUMN practice_sessions.source IS 'Origin of the practice session: from_diagnostic, study_plan_domain, etc.';
COMMENT ON COLUMN practice_sessions.source_session_id IS 'Optional reference to the diagnostic session that triggered this practice session';
COMMENT ON COLUMN practice_questions.domain_code IS 'Domain code snapshot for quick domain breakdown queries without joins';

