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
export async function getPmleAccessLevelForRequest(): Promise<{
  accessLevel: AccessLevel;
  user: User | null;
}> {
  // Dynamic import to avoid circular dependencies
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const { isSubscriber } = await import("@/lib/billing/paid-access");

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { accessLevel: "ANONYMOUS", user: null };
    }

    const hasPaidAccess = await isSubscriber(user.id);
    const accessLevel = getAccessLevel({ user, isSubscriber: hasPaidAccess });
    return { accessLevel, user };
  } catch {
    return { accessLevel: "ANONYMOUS", user: null };
  }
}
