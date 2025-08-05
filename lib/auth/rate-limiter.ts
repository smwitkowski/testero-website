import { Redis } from "@upstash/redis";

// Rate limiting configuration - centralized for consistency
export const RATE_LIMIT_CONFIG = {
  WINDOW_SECONDS: 60, // 1 minute window
  MAX_REQUESTS: 3, // 3 requests per window
  KEY_PREFIX: "rate_limit",
} as const;

// Redis client instance (singleton pattern)
let redis: Redis | null = null;

// Type definitions for better type safety (for future enhancements)
// interface RateLimitResult {
//   allowed: boolean;
//   remaining?: number;
//   resetTime?: number;
// }

// Initialize Redis client if credentials are available
function getRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // In test environment, always create Redis client (will be mocked)
  if (process.env.NODE_ENV === "test" || (redisUrl && redisToken)) {
    try {
      redis = new Redis({
        url: redisUrl || "test-url",
        token: redisToken || "test-token",
      });
      return redis;
    } catch (error) {
      console.error("Failed to initialize Redis client:", error);
      return null;
    }
  }

  // No Redis credentials - will fallback for development
  return null;
}

/**
 * Check if an IP address is within the rate limit
 * Uses Redis for distributed rate limiting in production
 * Falls back to allowing requests if Redis is unavailable (fail-open)
 *
 * @param ip - The IP address to check
 * @returns Promise<boolean> - true if request is allowed, false if rate limited
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const redisClient = getRedisClient();

  // Fallback to allowing requests if Redis is not available
  if (!redisClient) {
    return true;
  }

  const key = `${RATE_LIMIT_CONFIG.KEY_PREFIX}:${ip}`;

  try {
    // Get current count of requests for this IP
    const currentCount = await redisClient.llen(key);

    // If at or over limit, reject the request
    if (currentCount >= RATE_LIMIT_CONFIG.MAX_REQUESTS) {
      return false;
    }

    // Add current timestamp to the list
    const now = Date.now();
    await redisClient.lpush(key, now);

    // Keep only the most recent MAX_REQUESTS items
    await redisClient.ltrim(key, 0, RATE_LIMIT_CONFIG.MAX_REQUESTS - 1);

    // Set expiration for the key (cleanup)
    await redisClient.expire(key, RATE_LIMIT_CONFIG.WINDOW_SECONDS);

    return true;
  } catch (error) {
    // Log error but fail open (allow request) for availability
    console.error("Rate limiter error (failing open):", error);
    return true;
  }
}

/**
 * Clear rate limit for an IP address (useful for testing)
 *
 * @param ip - The IP address to clear rate limit for
 */
export async function clearRateLimit(ip: string): Promise<void> {
  const redisClient = getRedisClient();

  if (!redisClient) {
    return;
  }

  const key = `${RATE_LIMIT_CONFIG.KEY_PREFIX}:${ip}`;

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Error clearing rate limit:", error);
  }
}
