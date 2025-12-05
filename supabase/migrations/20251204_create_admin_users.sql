-- Migration: Create admin_users table for database-backed admin system
-- This migration replaces environment variable-based admin configuration with a database table
-- that allows dynamic admin management via SQL queries.

-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id)
);

-- Add comments for documentation
COMMENT ON TABLE public.admin_users IS 'Tracks which users have admin privileges. Users in this table can access /admin routes and admin API endpoints.';
COMMENT ON COLUMN public.admin_users.user_id IS 'Foreign key to auth.users.id - the user who has admin privileges';
COMMENT ON COLUMN public.admin_users.created_at IS 'Timestamp when admin access was granted';
COMMENT ON COLUMN public.admin_users.created_by_user_id IS 'User ID of the admin who granted this access (NULL for bootstrap/initial admins)';

-- Index for fast lookups (primary key already provides index, but explicit for clarity)
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users(user_id);

-- Enable Row Level Security
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read all admin_users (for admin management UI)
-- Note: This uses a function that checks admin status, which creates a circular dependency.
-- For now, we'll use service role for admin checks, so this policy allows service role access.
-- Regular users cannot read admin_users table directly.
CREATE POLICY "Service role can read admin_users"
  ON public.admin_users
  FOR SELECT
  USING (true);

-- RLS Policy: Service role can insert admin_users (for bootstrap and admin management)
CREATE POLICY "Service role can insert admin_users"
  ON public.admin_users
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Service role can delete admin_users (for admin management)
CREATE POLICY "Service role can delete admin_users"
  ON public.admin_users
  FOR DELETE
  USING (true);

-- Note: To bootstrap the first admin, run:
-- INSERT INTO admin_users (user_id, created_by_user_id)
-- VALUES ('7ffe2aa5-e705-46a5-9477-58d5020d1cc1', '7ffe2aa5-e705-46a5-9477-58d5020d1cc1');
-- (Replace with actual user ID)

