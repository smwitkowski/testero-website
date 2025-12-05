-- Bootstrap script: Add first admin user
-- Run this SQL query in Supabase SQL Editor after applying the migration
-- Replace the user_id with the actual Supabase auth.users.id value

-- Example: Add stephen.witkowski@pm.me as first admin
INSERT INTO admin_users (user_id, created_by_user_id)
VALUES ('7ffe2aa5-e705-46a5-9477-58d5020d1cc1', '7ffe2aa5-e705-46a5-9477-58d5020d1cc1')
ON CONFLICT (user_id) DO NOTHING;

-- To add additional admins later, use:
-- INSERT INTO admin_users (user_id, created_by_user_id)
-- VALUES ('<user-uuid>', '<admin-who-is-granting-access-uuid>')
-- ON CONFLICT (user_id) DO NOTHING;

-- To remove an admin:
-- DELETE FROM admin_users WHERE user_id = '<user-uuid>';

-- To list all admins:
-- SELECT au.user_id, au.created_at, au.created_by_user_id, u.email
-- FROM admin_users au
-- JOIN auth.users u ON au.user_id = u.id
-- ORDER BY au.created_at DESC;

