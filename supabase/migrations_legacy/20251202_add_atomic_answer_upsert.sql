-- Create SQL function for atomic answer upsert
-- This function deletes existing answers and inserts new ones in a single transaction
-- to prevent partial states if the insert fails after deletion

CREATE OR REPLACE FUNCTION upsert_question_answers(
  p_question_id UUID,
  p_answers JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing answers for this question
  DELETE FROM answers WHERE question_id = p_question_id;
  
  -- Insert new answers from JSONB array
  -- Each answer object should have: choice_label, choice_text, is_correct, explanation_text
  INSERT INTO answers (question_id, choice_label, choice_text, is_correct, explanation_text)
  SELECT
    p_question_id,
    (answer->>'choice_label')::text,
    (answer->>'choice_text')::text,
    (answer->>'is_correct')::boolean,
    CASE 
      WHEN answer->>'explanation_text' = '' THEN NULL
      ELSE (answer->>'explanation_text')::text
    END
  FROM jsonb_array_elements(p_answers) AS answer;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION upsert_question_answers(UUID, JSONB) IS 
  'Atomically replaces all answers for a question. Deletes existing answers and inserts new ones in a single transaction to prevent partial states.';
