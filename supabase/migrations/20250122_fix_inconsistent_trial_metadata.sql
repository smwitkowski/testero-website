-- Migration: Fix inconsistent has_used_trial metadata
-- Purpose: Reset has_used_trial metadata for users who have the flag set
-- but no corresponding subscription history, allowing them to start a trial
-- 
-- This migration addresses cases where:
-- 1. Previous trial creation attempts failed partway through
-- 2. Metadata was set but database insert failed
-- 3. Manual admin actions set metadata incorrectly
--
-- Safe to run multiple times (idempotent)

-- Step 1: Identify users with inconsistent metadata
-- Users with has_used_trial=true but no subscription history
CREATE OR REPLACE FUNCTION identify_inconsistent_trial_metadata()
RETURNS TABLE (
  user_id uuid,
  has_used_trial_metadata boolean,
  subscription_count bigint,
  latest_subscription_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    (u.raw_user_meta_data->>'has_used_trial')::boolean as has_used_trial_metadata,
    COUNT(us.id) as subscription_count,
    MAX(us.status)::text as latest_subscription_status
  FROM auth.users u
  LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
  WHERE (u.raw_user_meta_data->>'has_used_trial')::boolean = true
  GROUP BY u.id, (u.raw_user_meta_data->>'has_used_trial')::boolean
  HAVING COUNT(us.id) = 0 OR 
         -- Also include users where all subscriptions are in terminal states without trial_ends_at
         (COUNT(us.id) > 0 AND 
          NOT EXISTS (
            SELECT 1 FROM public.user_subscriptions us2 
            WHERE us2.user_id = u.id 
            AND us2.trial_ends_at IS NOT NULL
            AND us2.status NOT IN ('trialing')
          )
         );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create a function to safely reset metadata for inconsistent users
-- This function can be called via an admin API endpoint or run manually
CREATE OR REPLACE FUNCTION reset_inconsistent_trial_metadata()
RETURNS TABLE (
  user_id uuid,
  action_taken text,
  previous_metadata jsonb,
  new_metadata jsonb
) AS $$
DECLARE
  inconsistent_user RECORD;
  updated_metadata jsonb;
BEGIN
  -- Find users with inconsistent metadata
  FOR inconsistent_user IN
    SELECT 
      u.id,
      u.raw_user_meta_data as current_metadata
    FROM auth.users u
    LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
    WHERE (u.raw_user_meta_data->>'has_used_trial')::boolean = true
    GROUP BY u.id, u.raw_user_meta_data
    HAVING COUNT(us.id) = 0 OR 
           -- Users with subscriptions but no trial history
           (COUNT(us.id) > 0 AND 
            NOT EXISTS (
              SELECT 1 FROM public.user_subscriptions us2 
              WHERE us2.user_id = u.id 
              AND us2.trial_ends_at IS NOT NULL
            )
           )
  LOOP
    -- Reset has_used_trial to false
    updated_metadata := inconsistent_user.current_metadata;
    updated_metadata := jsonb_set(updated_metadata, '{has_used_trial}', 'false'::jsonb);
    
    -- Update user metadata
    UPDATE auth.users
    SET raw_user_meta_data = updated_metadata,
        updated_at = NOW()
    WHERE id = inconsistent_user.id;
    
    -- Return result
    user_id := inconsistent_user.id;
    action_taken := 'reset_has_used_trial';
    previous_metadata := inconsistent_user.current_metadata;
    new_metadata := updated_metadata;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create a view for monitoring inconsistent metadata (read-only)
CREATE OR REPLACE VIEW inconsistent_trial_metadata_view AS
SELECT 
  u.id as user_id,
  u.email,
  (u.raw_user_meta_data->>'has_used_trial')::boolean as has_used_trial_metadata,
  COUNT(us.id) as subscription_count,
  ARRAY_AGG(DISTINCT us.status) FILTER (WHERE us.status IS NOT NULL) as subscription_statuses,
  MAX(us.trial_ends_at) as latest_trial_ends_at,
  MAX(us.created_at) as latest_subscription_created_at,
  u.created_at as user_created_at
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
WHERE (u.raw_user_meta_data->>'has_used_trial')::boolean = true
GROUP BY u.id, u.email, (u.raw_user_meta_data->>'has_used_trial')::boolean, u.created_at
HAVING COUNT(us.id) = 0 OR 
       -- Users with subscriptions but no trial history
       (COUNT(us.id) > 0 AND 
        NOT EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = u.id 
          AND us2.trial_ends_at IS NOT NULL
        )
       );

-- Grant access to the view (read-only for service role)
GRANT SELECT ON inconsistent_trial_metadata_view TO service_role;

-- Note: The reset_inconsistent_trial_metadata() function should be called manually
-- or via an admin API endpoint, not automatically on migration.
-- To run it manually:
-- SELECT * FROM reset_inconsistent_trial_metadata();
--
-- To check for inconsistent users before running:
-- SELECT * FROM inconsistent_trial_metadata_view;

