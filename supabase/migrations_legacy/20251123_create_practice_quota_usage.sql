-- Create practice_quota_usage table to track weekly free practice limits
CREATE TABLE practice_quota_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam TEXT NOT NULL, -- Exam identifier (e.g., 'pmle', 'GCP_PM_ML_ENG')
    week_start DATE NOT NULL, -- ISO week start date
    sessions_started INTEGER NOT NULL DEFAULT 0,
    questions_served INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique record per user, exam, and week
    UNIQUE (user_id, exam, week_start)
);

-- Create indexes
CREATE INDEX practice_quota_usage_user_id_idx ON practice_quota_usage(user_id);
CREATE INDEX practice_quota_usage_week_start_idx ON practice_quota_usage(week_start);

-- Add comments
COMMENT ON TABLE practice_quota_usage IS 'Tracks usage of free practice quota for users per week.';
COMMENT ON COLUMN practice_quota_usage.week_start IS 'The start date of the week (ISO week) for this usage record.';

-- RPC function to check and increment quota atomically
CREATE OR REPLACE FUNCTION check_and_increment_practice_quota(
  p_user_id UUID,
  p_exam TEXT,
  p_questions_count INTEGER,
  p_max_sessions INTEGER,
  p_max_questions INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_sessions_started INTEGER;
  v_questions_served INTEGER;
BEGIN
  v_week_start := date_trunc('week', now())::DATE;
  
  -- Get current usage or initialize
  SELECT sessions_started, questions_served
  INTO v_sessions_started, v_questions_served
  FROM practice_quota_usage
  WHERE user_id = p_user_id AND exam = p_exam AND week_start = v_week_start;
  
  IF NOT FOUND THEN
    v_sessions_started := 0;
    v_questions_served := 0;
  END IF;
  
  -- Check quota
  -- If we have already met or exceeded the limits, deny access
  IF v_sessions_started >= p_max_sessions OR v_questions_served >= p_max_questions THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'sessions_started', v_sessions_started,
      'questions_served', v_questions_served,
      'week_start', v_week_start
    );
  END IF;
  
  -- Increment usage
  INSERT INTO practice_quota_usage (user_id, exam, week_start, sessions_started, questions_served)
  VALUES (p_user_id, p_exam, v_week_start, 1, p_questions_count)
  ON CONFLICT (user_id, exam, week_start)
  DO UPDATE SET
    sessions_started = practice_quota_usage.sessions_started + 1,
    questions_served = practice_quota_usage.questions_served + p_questions_count,
    updated_at = NOW();
    
  RETURN jsonb_build_object(
    'allowed', true,
    'sessions_started', v_sessions_started + 1,
    'questions_served', v_questions_served + p_questions_count,
    'week_start', v_week_start
  );
END;
$$;

-- Grant execute permission to authenticated users (required for PostgREST to expose the function)
GRANT EXECUTE ON FUNCTION check_and_increment_practice_quota(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_practice_quota(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO anon;
