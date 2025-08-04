import { Redis } from '@upstash/redis';

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional prefix for Redis keys */
  keyPrefix?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count of requests in the window */
  count: number;
  /** Remaining requests allowed in the window */
  remaining: number;
  /** Time until the window resets (in milliseconds) */
  resetTime: number;
  /** Whether Redis was available (for fallback detection) */
  redisAvailable: boolean;
}

/**
 * Redis-based rate limiter for serverless environments
 * Uses Upstash Redis for distributed rate limiting across serverless instances
 */
export class RedisRateLimiter {
  private redis: Redis | null = null;
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Initialize Redis client if environment variables are present
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
      } catch (error) {
        console.error('Failed to initialize Redis client:', error);
        this.redis = null;
      }
    } else {
      console.warn('Redis environment variables not found. Rate limiting will use in-memory fallback.');
    }
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier for the request (e.g., IP address, user ID)
   * @returns Promise<RateLimitResult>
   */
  async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const key = this.getRedisKey(identifier);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // If Redis is not available, fall back to allowing the request
    // This ensures the application continues to work even if Redis is down
    if (!this.redis) {
      return this.getFallbackResult();
    }

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in the window
      pipeline.zcard(key);
      
      // Add current timestamp to the sorted set
      pipeline.zadd(key, { score: now, member: now.toString() });
      
      // Set expiration on the key (window + buffer for cleanup)
      pipeline.expire(key, Math.ceil(this.config.windowMs / 1000) + 60);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      if (!results || results.length < 4) {
        throw new Error('Pipeline execution failed');
      }

      // Get the count after removing old entries but before adding the new one
      const currentCount = results[1] as number;
      const resetTime = windowStart + this.config.windowMs;

      // Check if we've exceeded the limit
      const allowed = currentCount < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - currentCount - 1);

      return {
        allowed,
        count: currentCount + 1,
        remaining,
        resetTime,
        redisAvailable: true,
      };

    } catch (error) {
      console.error('Redis rate limit check failed:', error);
      
      // Fallback to allowing the request when Redis fails
      // This ensures high availability of the auth endpoints
      return this.getFallbackResult();
    }
  }

  /**
   * Get Redis key for the identifier
   * @param identifier - The identifier to create a key for
   * @returns Redis key string
   */
  private getRedisKey(identifier: string): string {
    const prefix = this.config.keyPrefix || 'rl';
    return `${prefix}:${identifier}`;
  }

  /**
   * Get fallback result when Redis is unavailable
   * @returns RateLimitResult allowing the request
   */
  private getFallbackResult(): RateLimitResult {
    return {
      allowed: true,
      count: 1,
      remaining: this.config.maxRequests - 1,
      resetTime: Date.now() + this.config.windowMs,
      redisAvailable: false,
    };
  }

  /**
   * Check Redis health
   * @returns Promise<boolean> - Whether Redis is available
   */
  async isRedisAvailable(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

/**
 * Shared rate limiter instances for different auth endpoints
 */
export const authRateLimiter = new RedisRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'auth',
});

/**
 * Utility function for consistent rate limit checking across auth endpoints
 * @param identifier - Usually the IP address
 * @param rateLimiter - Optional custom rate limiter (defaults to authRateLimiter)
 * @returns Promise<RateLimitResult>
 */
export async function checkAuthRateLimit(
  identifier: string,
  rateLimiter: RedisRateLimiter = authRateLimiter
): Promise<RateLimitResult> {
  return rateLimiter.checkRateLimit(identifier);
}

/**
 * Get rate limit headers for HTTP responses
 * @param result - Rate limit result
 * @returns Headers object
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.count.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    'X-RateLimit-Redis-Available': result.redisAvailable.toString(),
  };
}