/**
 * Server-side PMLE Access & Entitlements Helper
 * 
 * This file contains server-only helpers that require Next.js server APIs.
 * Import this only in API routes and Server Components.
 */

import type { User } from "@supabase/supabase-js";
import { getAccessLevel, type AccessLevel } from "./pmleEntitlements";

/**
 * Server-side helper to get PMLE access level from a Request
 * 
 * This function:
 * 1. Gets the authenticated user from Supabase
 * 2. Checks subscription status using isSubscriber()
 * 3. Returns the computed access level
 * 
 * @returns Promise with access level and user object
 */
export async function getPmleAccessLevelForRequest(): Promise<{ accessLevel: AccessLevel; user: User | null }> {
  // Dynamic import to avoid circular dependencies
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const { isSubscriber } = await import("@/lib/auth/entitlements");

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { accessLevel: "ANONYMOUS", user: null };
  }

  const hasSubscription = await isSubscriber(user.id);
  const accessLevel = getAccessLevel({ user, isSubscriber: hasSubscription });

  return { accessLevel, user };
}

