/**
 * Analytics event deduplication utility to prevent duplicate events during rapid navigation
 */

interface EventKey {
  eventName: string;
  userId?: string;
  context?: Record<string, unknown>;
}

interface EventTracker {
  timestamp: number;
  count: number;
}

// Cache to track recent events
const eventCache = new Map<string, EventTracker>();

// Default deduplication window in milliseconds
const DEFAULT_DEDUPLICATION_WINDOW = 2000; // 2 seconds

/**
 * Generate a unique key for event deduplication
 */
const generateEventKey = (eventKey: EventKey): string => {
  const contextString = eventKey.context ? JSON.stringify(eventKey.context) : "";
  return `${eventKey.eventName}:${eventKey.userId || "anonymous"}:${contextString}`;
};

/**
 * Check if an event should be deduplicated
 * @param eventName - Name of the analytics event
 * @param userId - Optional user ID
 * @param context - Optional context for the event
 * @param windowMs - Deduplication window in milliseconds
 * @returns true if event should be sent, false if it should be deduplicated
 */
export const shouldTrackEvent = (
  eventName: string,
  userId?: string,
  context?: Record<string, unknown>,
  windowMs: number = DEFAULT_DEDUPLICATION_WINDOW
): boolean => {
  const key = generateEventKey({ eventName, userId, context });
  const now = Date.now();
  
  const existing = eventCache.get(key);
  
  // If no existing event, allow this one
  if (!existing) {
    eventCache.set(key, { timestamp: now, count: 1 });
    return true;
  }
  
  // If outside the deduplication window, allow this one
  if (now - existing.timestamp > windowMs) {
    eventCache.set(key, { timestamp: now, count: 1 });
    return true;
  }
  
  // Within deduplication window - increment count but don't send
  existing.count++;
  return false;
};

/**
 * Wrapper for PostHog capture with automatic deduplication
 * @param posthog - PostHog instance
 * @param eventName - Name of the event
 * @param properties - Event properties
 * @param options - Deduplication options
 */
export interface DeduplicationOptions {
  windowMs?: number;
  forceTrack?: boolean; // Skip deduplication for critical events
}

// PostHog instance type
type PostHogInstance = {
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
};

export const captureWithDeduplication = (
  posthog: PostHogInstance | null | undefined,
  eventName: string,
  properties: Record<string, unknown> = {},
  options: DeduplicationOptions = {}
): boolean => {
  if (!posthog) return false;
  
  // Skip deduplication if forced
  if (options.forceTrack) {
    posthog.capture(eventName, properties);
    return true;
  }
  
  const userId = properties.user_id as string | undefined;
  const context = { ...properties };
  delete context.user_id; // Remove user_id from context to avoid duplication
  
  if (shouldTrackEvent(eventName, userId, context, options.windowMs)) {
    posthog.capture(eventName, properties);
    return true;
  }
  
  return false;
};

/**
 * Clean up old entries from the event cache to prevent memory leaks
 * Should be called periodically
 */
export const cleanupEventCache = (maxAgeMs: number = 60000): void => {
  const now = Date.now();
  
  // Convert to array to avoid iterator issues
  const entries = Array.from(eventCache.entries());
  for (const [key, tracker] of entries) {
    if (now - tracker.timestamp > maxAgeMs) {
      eventCache.delete(key);
    }
  }
};

// Automatically clean up cache every minute
if (typeof window !== "undefined") {
  setInterval(() => cleanupEventCache(), 60000);
}