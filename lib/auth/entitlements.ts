import { LRUCache } from "lru-cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface CacheEntry {
  isSubscriber: boolean;
  timestamp: number;
}

// LRU cache with TTL: 60 seconds, max 500 entries
const subscriberCache = new LRUCache<string, CacheEntry>({
  max: 500,
  ttl: 60 * 1000, // 60 seconds in milliseconds
});

/**
 * Check if a user has an active or trialing subscription.
 * Results are cached for 60 seconds to reduce database queries.
 *
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user has active/trialing subscription, false otherwise
 */
export async function isSubscriber(userId: string): Promise<boolean> {
  // Check cache first
  const cached = subscriberCache.get(userId);
  if (cached) {
    return cached.isSubscriber;
  }

  // Query database
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"]);

  // Return false on error or no subscription
  const hasSubscription = !error && data && data.length > 0;

  // Cache the result
  subscriberCache.set(userId, {
    isSubscriber: hasSubscription,
    timestamp: Date.now(),
  });

  return hasSubscription;
}

/**
 * Clear the subscriber cache for a specific user.
 * Useful when subscription status changes and cache needs invalidation.
 *
 * @param userId - The user ID to clear from cache
 */
export function clearSubscriberCache(userId: string): void {
  subscriberCache.delete(userId);
}

/**
 * Clear all cached subscriber entries.
 * Useful for testing or cache invalidation scenarios.
 */
export function clearAllSubscriberCache(): void {
  subscriberCache.clear();
}

