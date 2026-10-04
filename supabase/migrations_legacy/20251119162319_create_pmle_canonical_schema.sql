-- Migration: Create canonical PMLE question schema
-- This migration creates the new canonical tables for PMLE questions, answers, explanations, and domains.
-- Legacy tables (questions, options, etc.) are renamed to _legacy suffix if they exist.

-- Handle legacy tables first (non-destructive rename if they exist)
-- If legacy tables exist with the same names, rename them to _legacy suffix
-- Then create fresh canonical tables with the original names
DO $$
BEGIN
    -- Rename legacy questions table if it exists and canonical table doesn't exist yet
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questions') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questions_legacy') THEN
        ALTER TABLE public.questions RENAME TO questions_legacy;
        COMMENT ON TABLE public.questions_legacy IS 'DEPRECATED: Legacy questions table. Use canonical questions table instead.';
    END IF;
    
    -- Rename legacy options table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'options')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'options_legacy') THEN
        ALTER TABLE public.options RENAME TO options_legacy;
        COMMENT ON TABLE public.options_legacy IS 'DEPRECATED: Legacy options table. Use canonical answers table instead.';
    END IF;
    
    -- Check for legacy explanations table (if it exists with different structure)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'explanations')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'explanations_legacy') THEN
        ALTER TABLE public.explanations RENAME TO explanations_legacy;
        COMMENT ON TABLE public.explanations_legacy IS 'DEPRECATED: Legacy explanations table. Use canonical explanations table instead.';
    END IF;
END $$;

-- Create exam_domains table
CREATE TABLE IF NOT EXISTS public.exam_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
);

COMMENT ON TABLE public.exam_domains IS 'Blueprint domains/topics for exams (e.g., "Designing ML Pipelines")';
COMMENT ON COLUMN public.exam_domains.code IS 'Domain code in uppercase with underscores (e.g., "DATA_PIPELINES")';
COMMENT ON COLUMN public.exam_domains.name IS 'Human-readable domain name (e.g., "Designing ML Pipelines")';

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES public.exam_domains(id) ON DELETE RESTRICT,
    stem TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    source_ref TEXT,
    status TEXT CHECK (status IN ('ACTIVE', 'DRAFT', 'RETIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.questions IS 'Canonical questions table for PMLE and future exams';
COMMENT ON COLUMN public.questions.exam IS 'Exam identifier (e.g., "GCP_PM_ML_ENG")';
COMMENT ON COLUMN public.questions.domain_id IS 'Foreign key to exam_domains';
COMMENT ON COLUMN public.questions.stem IS 'The question text/scenario';
COMMENT ON COLUMN public.questions.difficulty IS 'Difficulty level: EASY, MEDIUM, or HARD';
COMMENT ON COLUMN public.questions.status IS 'Question status: ACTIVE, DRAFT, or RETIRED';
COMMENT ON COLUMN public.questions.source_ref IS 'Reference to blueprint section or doc URL slug';

-- Create answers table
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    choice_label TEXT NOT NULL,
    choice_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.answers IS 'Answer choices for questions. Each question should have 3-5 answers with exactly one marked as correct.';
COMMENT ON COLUMN public.answers.choice_label IS 'Label for the choice (e.g., "A", "B", "C", "D")';
COMMENT ON COLUMN public.answers.choice_text IS 'The answer option text';
COMMENT ON COLUMN public.answers.is_correct IS 'Whether this is the correct answer (exactly one per question should be true)';

-- Create explanations table
CREATE TABLE IF NOT EXISTS public.explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
    explanation_text TEXT NOT NULL,
    reasoning_style TEXT,
    doc_links JSONB
);

COMMENT ON TABLE public.explanations IS 'Explanations for questions. Each question should have exactly one explanation.';
COMMENT ON COLUMN public.explanations.question_id IS 'Foreign key to questions (unique - one explanation per question)';
COMMENT ON COLUMN public.explanations.explanation_text IS 'The explanation text explaining why the correct answer is correct';
COMMENT ON COLUMN public.explanations.reasoning_style IS 'Optional reasoning style (e.g., "SHORT_RATIONALE")';
COMMENT ON COLUMN public.explanations.doc_links IS 'JSON array of URLs or document identifiers';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS questions_exam_idx ON public.questions(exam);
CREATE INDEX IF NOT EXISTS questions_domain_id_idx ON public.questions(domain_id);
CREATE INDEX IF NOT EXISTS answers_question_id_idx ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS explanations_question_id_idx ON public.explanations(question_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

