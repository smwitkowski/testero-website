/**
 * Manual mock for rate-limiter to avoid ESM parsing issues with @upstash/redis
 * Jest will automatically use this mock when tests call jest.mock("@/lib/auth/rate-limiter")
 */

// Rate limiting configuration - matches actual implementation
export const RATE_LIMIT_CONFIG = {
  WINDOW_SECONDS: 60, // 1 minute window
  MAX_REQUESTS: 3, // 3 requests per window
  KEY_PREFIX: "rate_limit",
} as const;

/**
 * Mock checkRateLimit function as a Jest mock
 * By default, allows all requests (returns true)
 * Tests can override this behavior using .mockResolvedValue() or .mockReturnValue()
 */
export const checkRateLimit = jest.fn().mockResolvedValue(true);

/**
 * Mock clearRateLimit function as a Jest mock
 * No-op in tests unless specifically mocked
 */
export const clearRateLimit = jest.fn().mockResolvedValue(undefined);

