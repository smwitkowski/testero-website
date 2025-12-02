-- Add explanation_text column to answers table
-- This allows each answer option to have its own explanation
-- explaining why it's correct or incorrect

ALTER TABLE public.answers
ADD COLUMN IF NOT EXISTS explanation_text TEXT;

COMMENT ON COLUMN public.answers.explanation_text IS 'Explanation for why this answer option is correct or incorrect';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS answers_explanation_text_idx ON public.answers(explanation_text) WHERE explanation_text IS NOT NULL;

-- Migration strategy:
-- For existing questions, we'll need to manually migrate explanations
-- from the explanations table to the appropriate answer rows.
-- This migration just adds the column structure.
