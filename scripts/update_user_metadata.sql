-- SQL query to update user metadata and add is_early_access flag
-- This query can be run in the Supabase SQL Editor

-- Update a specific user by email (replace with actual email)
UPDATE auth.users 
SET raw_user_meta_data = 
  raw_user_meta_data || 
  '{"is_early_access": true}'::jsonb
WHERE email = 'stephen.witkowski@protonmail.com';

-- If you need to update multiple users at once:
/*
UPDATE auth.users 
SET raw_user_meta_data = 
  raw_user_meta_data || 
  '{"is_early_access": true}'::jsonb
WHERE email IN (
  'user1@example.com', 
  'user2@example.com',
  'user3@example.com'
);
*/

-- To revert (remove the flag):
/*
UPDATE auth.users 
SET raw_user_meta_data = 
  raw_user_meta_data - 'is_early_access'
WHERE email = 'stephen.witkowski@protonmail.com';
*/

-- To check if the update was successful:
/*
SELECT 
  email, 
  raw_user_meta_data->>'is_early_access' as is_early_access
FROM auth.users
WHERE email = 'stephen.witkowski@protonmail.com';
*/
