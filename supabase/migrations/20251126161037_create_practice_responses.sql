-- Migration: Create practice_responses table
-- This table stores user responses to practice session questions, mirroring
-- the diagnostic_responses pattern for consistency.
--
-- Pattern mirrors diagnostic_responses table structure:
-- - Links to practice_sessions via session_id
-- - Links to practice_questions (snapshot) via question_id
-- - Stores selected_label and is_correct boolean
-- - Tracks responded_at timestamp

CREATE TABLE practice_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
    selected_label TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX practice_responses_session_id_idx ON practice_responses(session_id);
CREATE INDEX practice_responses_question_id_idx ON practice_responses(question_id);
CREATE INDEX practice_responses_responded_at_idx ON practice_responses(responded_at DESC);

-- Add comments for documentation
COMMENT ON TABLE practice_responses IS 'User responses to practice session questions. Mirrors diagnostic_responses pattern for consistency.';
COMMENT ON COLUMN practice_responses.session_id IS 'Foreign key to practice_sessions';
COMMENT ON COLUMN practice_responses.question_id IS 'Foreign key to practice_questions (snapshot)';
COMMENT ON COLUMN practice_responses.selected_label IS 'The label of the selected option (e.g., "A", "B", "C", "D")';
COMMENT ON COLUMN practice_responses.is_correct IS 'Whether the selected answer is correct';
COMMENT ON COLUMN practice_responses.responded_at IS 'Timestamp when the response was submitted';



