import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBillingEnforcement } from "@/lib/config/billing";
import { verifyGraceCookie, hasGraceCookie, clearGraceCookie } from "@/lib/billing/grace-cookie";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

// Per-user LRU cache with TTL
const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];
const MAX_CACHE_SIZE = 1000;
const POSITIVE_TTL_MS = 60 * 1000; // 60 seconds
const NEGATIVE_TTL_MS = 30 * 1000; // 30 seconds

function updateAccessOrder(userId: string): void {
  // Remove from current position
  const index = accessOrder.indexOf(userId);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  // Add to end (most recently used)
  accessOrder.push(userId);
}

function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove least recently used
    const lru = accessOrder.shift();
    if (lru) {
      cache.delete(lru);
    }
  }
}

function getCachedValue(userId: string): boolean | null {
  const entry = cache.get(userId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    cache.delete(userId);
    const index = accessOrder.indexOf(userId);
    if (index > -1) {
      accessOrder.splice(index, 1);
    }
    return null;
  }

  updateAccessOrder(userId);
  return entry.value;
}

function setCachedValue(userId: string, value: boolean): void {
  const now = Date.now();
  const ttl = value ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  const expiresAt = now + ttl;

  if (!cache.has(userId)) {
    evictIfNeeded();
  }

  cache.set(userId, { value, expiresAt });
  updateAccessOrder(userId);
}

function computeSubscriptionEntitlement(
  status: string,
  cancelAtPeriodEnd: boolean,
  currentPeriodEnd: string | null
): boolean {
  const now = new Date();
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;

  // Active or trialing status grants access
  if (status === "active" || status === "trialing") {
    // If cancel_at_period_end is true, check if period hasn't ended yet
    if (cancelAtPeriodEnd && periodEnd) {
      return now < periodEnd;
    }
    // If cancel_at_period_end is false, grant access
    return true;
  }

  // All other statuses (past_due, canceled, etc.) do not grant access
  return false;
}

/**
 * Check if a user has an active subscription
 * Results are cached per user with TTL (60s for positive, 30s for negative)
 */
export async function isSubscriber(userId: string): Promise<boolean> {
  // Check cache first
  const cached = getCachedValue(userId);
  if (cached !== null) {
    return cached;
  }

  // Query database
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No subscription found or error
    setCachedValue(userId, false);
    return false;
  }

  const isEntitled = computeSubscriptionEntitlement(
    data.status,
    data.cancel_at_period_end || false,
    data.current_period_end
  );

  setCachedValue(userId, isEntitled);
  return isEntitled;
}

export interface AccessResult {
  allowed: boolean;
  code?: string;
  details?: {
    route?: string;
    computed_status?: string;
    cancel_at_period_end?: boolean;
    current_period_end?: string | null;
    request_id?: string;
  };
}

/**
 * Require subscriber access based on feature flag
 * Returns access result object that caller can map to HTTP response
 */
export async function requireSubscriber(
  req: NextRequest | Request,
  userId: string
): Promise<AccessResult> {
  const enforcement = getBillingEnforcement();

  // Feature flag: 'off' always allows
  if (enforcement === "off") {
    return { allowed: true };
  }

  // Feature flag: 'active_required' checks subscription or grace cookie
  if (enforcement === "active_required") {
    const hasSubscription = await isSubscriber(userId);
    const hasValidGraceCookie = verifyGraceCookie(req);
    const graceCookiePresent = hasGraceCookie(req);

    // Clear grace cookie if subscription is active (first successful entitlement pass)
    if (hasSubscription && graceCookiePresent) {
      // Return access result with cookie clearing instruction
      // The caller should clear the cookie in their response
      return { allowed: true };
    }

    // Clear invalid/expired grace cookie
    if (graceCookiePresent && !hasValidGraceCookie) {
      // Cookie is present but invalid/expired - will be cleared by caller
    }

    if (hasSubscription || hasValidGraceCookie) {
      return { allowed: true };
    }

    // Blocked - gather details for logging and analytics
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("user_subscriptions")
      .select("status, cancel_at_period_end, current_period_end")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .single();

    const route = req instanceof NextRequest
      ? req.nextUrl.pathname
      : new URL(req.url).pathname;

    const requestId =
      req.headers.get("x-request-id") || req.headers.get("x-vercel-id") || undefined;

    const details = {
      route,
      computed_status: data?.status,
      cancel_at_period_end: data?.cancel_at_period_end || false,
      current_period_end: data?.current_period_end || null,
      request_id: requestId,
    };

    // Structured logging
    console.warn({
      paywall_block: {
        user_id: userId,
        ...details,
      },
    });

    // Analytics event
    const posthog = getServerPostHog();
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
      {
        user_id: userId,
        ...details,
      },
      userId
    );

    return {
      allowed: false,
      code: "PAYWALL",
      details,
    };
  }

  // Unknown enforcement mode - default to allow
  return { allowed: true };
}

/**
 * Clear cache - exposed for testing purposes only
 */
export function clearCache(): void {
  cache.clear();
  accessOrder.length = 0;
}

