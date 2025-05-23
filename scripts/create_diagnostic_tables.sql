CREATE TABLE diagnostics_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE diagnostic_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES diagnostics_sessions(id) ON DELETE CASCADE,
    question_id UUID, -- Nullable, for AI-generated questions not yet in main questions table
    stem TEXT NOT NULL,
    options JSONB NOT NULL, -- Store options as JSONB array of { label: string, text: string }
    correct_label TEXT NOT NULL -- Store the label of the correct option
);

CREATE TABLE diagnostic_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES diagnostics_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES diagnostic_questions(id) ON DELETE CASCADE,
    selected_label TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
