/**
 * Admin authentication helper
 * 
 * Checks if a user is an admin by querying the admin_users table in Supabase.
 * Uses React's cache() for true per-request memoization in Next.js.
 * Cache is automatically cleared between requests.
 * 
 * Database table: public.admin_users
 * - user_id: UUID foreign key to auth.users.id
 * - created_at: Timestamp when admin access was granted
 * - created_by_user_id: UUID of admin who granted access
 */

import { cache } from 'react';
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * Check if a user is an admin by querying the admin_users table
 * 
 * Uses React's cache() for automatic per-request memoization.
 * The cache is automatically cleared between requests in Next.js.
 * 
 * @param user - User object with id and optional email
 * @returns Promise<boolean> - true if user is an admin, false otherwise
 */
export async function isAdmin(user: { id: string; email?: string | null }): Promise<boolean> {
  if (!user || !user.id) {
    return false;
  }

  return checkAdminCached(user.id);
}

/**
 * Cached database query to check if a user is an admin
 * 
 * Wrapped with React's cache() for automatic per-request memoization.
 * This ensures we only query the database once per user per request.
 * 
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user exists in admin_users table
 */
const checkAdminCached = cache(async (userId: string): Promise<boolean> => {
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error) {
      // If error is "PGRST116" (no rows returned), user is not an admin
      if (error.code === "PGRST116") {
        return false;
      }
      // Log other errors but don't throw - fail closed (no admin access on error)
      console.error("[isAdmin] Database error:", error);
      return false;
    }

    // If data exists, user is an admin
    return !!data;
  } catch (error) {
    // Fail closed - if we can't verify, deny admin access
    console.error("[isAdmin] Unexpected error:", error);
    return false;
  }
});
