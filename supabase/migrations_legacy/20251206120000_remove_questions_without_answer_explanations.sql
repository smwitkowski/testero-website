-- Migration: Remove questions without answer explanations
-- This migration permanently deletes questions where any answer option lacks explanation_text
-- WARNING: This is a destructive operation. Related answers and explanations will be 
-- automatically deleted via CASCADE constraints.

-- First, identify and log questions to delete (for reporting)
DO $$
DECLARE
    questions_to_delete_count INTEGER;
    question_ids_to_delete UUID[];
BEGIN
    -- Count and collect questions that will be deleted
    SELECT COUNT(DISTINCT q.id), array_agg(DISTINCT q.id)
    INTO questions_to_delete_count, question_ids_to_delete
    FROM questions q
    WHERE q.exam = 'GCP_PM_ML_ENG'
      AND EXISTS (
          SELECT 1
          FROM answers a
          WHERE a.question_id = q.id
            AND (a.explanation_text IS NULL OR TRIM(a.explanation_text) = '')
      );
    
    RAISE NOTICE 'Found % questions to delete (missing answer explanations)', questions_to_delete_count;
    
    -- Log question IDs for reference (first 10)
    IF questions_to_delete_count > 0 THEN
        RAISE NOTICE 'Sample question IDs to be deleted: %', array_to_string(question_ids_to_delete[1:LEAST(10, array_length(question_ids_to_delete, 1))], ', ');
    END IF;
END $$;

-- Delete questions that don't have explanation_text on all their answers
-- CASCADE will automatically delete related answers and explanations
DELETE FROM questions
WHERE exam = 'GCP_PM_ML_ENG'
  AND EXISTS (
      SELECT 1
      FROM answers a
      WHERE a.question_id = questions.id
        AND (a.explanation_text IS NULL OR TRIM(a.explanation_text) = '')
  );


