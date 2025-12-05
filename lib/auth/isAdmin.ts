/**
 * Admin authentication helper
 * 
 * Checks if a user is an admin by querying the admin_users table in Supabase.
 * Uses request-level caching to avoid repeated database queries within the same request.
 * 
 * Database table: public.admin_users
 * - user_id: UUID foreign key to auth.users.id
 * - created_at: Timestamp when admin access was granted
 * - created_by_user_id: UUID of admin who granted access
 */

import { createServiceSupabaseClient } from "@/lib/supabase/service";

// Request-level cache to avoid repeated DB queries in the same request
// Key: user_id, Value: Promise<boolean>
const adminCache = new Map<string, Promise<boolean>>();

/**
 * Check if a user is an admin by querying the admin_users table
 * 
 * Uses request-level caching to avoid repeated database queries.
 * Cache is cleared between requests (Map is recreated per request in serverless context).
 * 
 * @param user - User object with id and optional email
 * @returns Promise<boolean> - true if user is an admin, false otherwise
 */
export async function isAdmin(user: { id: string; email?: string | null }): Promise<boolean> {
  if (!user || !user.id) {
    return false;
  }

  // Check cache first
  const cached = adminCache.get(user.id);
  if (cached !== undefined) {
    return cached;
  }

  // Query database and cache the promise
  const adminPromise = checkAdminInDatabase(user.id);
  adminCache.set(user.id, adminPromise);

  return adminPromise;
}

/**
 * Query the database to check if a user is an admin
 * 
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user exists in admin_users table
 */
async function checkAdminInDatabase(userId: string): Promise<boolean> {
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
}

/**
 * Clear the admin cache (useful for testing or explicit cache invalidation)
 * In serverless environments, this is typically not needed as the cache is per-request
 */
export function clearAdminCache(): void {
  adminCache.clear();
}
