-- Migration: Create question_generation_runs table and add generation_run_id to questions
-- This migration introduces tracking for generation runs to support review, rollback, and comparison
-- of question generation batches in the content pipeline.

-- Create question_generation_runs table
CREATE TABLE IF NOT EXISTS public.question_generation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam TEXT NOT NULL,
    domain_code TEXT NOT NULL,
    target_count INT NOT NULL,
    generated_count INT NOT NULL DEFAULT 0,
    model TEXT NOT NULL,
    prompt_version TEXT NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE public.question_generation_runs IS 'Tracks generation runs for question batches. Each run represents a single generation attempt for a specific exam and domain.';
COMMENT ON COLUMN public.question_generation_runs.exam IS 'Exam identifier (e.g., "GCP_PM_ML_ENG")';
COMMENT ON COLUMN public.question_generation_runs.domain_code IS 'Domain code matching exam_domains.code (e.g., "DATA_PIPELINES")';
COMMENT ON COLUMN public.question_generation_runs.target_count IS 'Number of questions we attempted to generate in this run';
COMMENT ON COLUMN public.question_generation_runs.generated_count IS 'Number of questions actually inserted into the questions table';
COMMENT ON COLUMN public.question_generation_runs.model IS 'Model identifier used for generation (e.g., "gpt-5.1", "gemini-2.5-pro")';
COMMENT ON COLUMN public.question_generation_runs.prompt_version IS 'Version identifier for the prompt used (e.g., "v1", "2024-11-22")';
COMMENT ON COLUMN public.question_generation_runs.notes IS 'Optional free-form comments about the run';
COMMENT ON COLUMN public.question_generation_runs.created_by IS 'User who initiated the generation run (references auth.users)';
COMMENT ON COLUMN public.question_generation_runs.started_at IS 'When the generation run started';
COMMENT ON COLUMN public.question_generation_runs.completed_at IS 'When the generation run completed (NULL if still in progress)';

-- Add generation_run_id column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS generation_run_id UUID NULL REFERENCES public.question_generation_runs(id);

COMMENT ON COLUMN public.questions.generation_run_id IS 'Foreign key to question_generation_runs. NULL for existing questions or manually created questions.';

-- Create index for performance on generation_run_id
CREATE INDEX IF NOT EXISTS questions_generation_run_id_idx ON public.questions(generation_run_id);

-- Create index for common queries on question_generation_runs
CREATE INDEX IF NOT EXISTS question_generation_runs_exam_idx ON public.question_generation_runs(exam);
CREATE INDEX IF NOT EXISTS question_generation_runs_domain_code_idx ON public.question_generation_runs(domain_code);
CREATE INDEX IF NOT EXISTS question_generation_runs_started_at_idx ON public.question_generation_runs(started_at);


