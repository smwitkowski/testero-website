-- Migration: Add review metadata to canonical questions schema
-- This migration adds review_status and review_notes columns to track question audit workflow
-- separate from delivery status (status column).

-- Add review_status column with app-level enum constraint
ALTER TABLE public.questions
ADD COLUMN review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
CHECK (review_status IN ('UNREVIEWED', 'GOOD', 'NEEDS_ANSWER_FIX', 'NEEDS_EXPLANATION_FIX', 'RETIRED'));

-- Add review_notes column for free-form audit notes
ALTER TABLE public.questions
ADD COLUMN review_notes TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.questions.review_status IS 'Audit workflow status: UNREVIEWED, GOOD, NEEDS_ANSWER_FIX, NEEDS_EXPLANATION_FIX, or RETIRED';
COMMENT ON COLUMN public.questions.review_notes IS 'Free-form notes for question review/audit process';

-- Index for filtering by review status in admin queries
CREATE INDEX IF NOT EXISTS questions_review_status_idx ON public.questions(review_status);

-- Backfill: All existing ACTIVE questions start as UNREVIEWED
-- (DEFAULT already handles this, but explicit for clarity)
UPDATE public.questions
SET review_status = 'UNREVIEWED'
WHERE status = 'ACTIVE' AND review_status IS NULL;

