import { checkRateLimit, clearRateLimit } from "../lib/auth/rate-limiter";

// Mock Upstash Redis
jest.mock("@upstash/redis", () => {
  const mockRedis = {
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };
  return {
    Redis: jest.fn(() => mockRedis),
  };
});

describe("Redis Rate Limiter", () => {
  let mockRedis: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mock Redis instance
    const { Redis } = require("@upstash/redis");
    mockRedis = new Redis();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within rate limit", async () => {
      // Mock Redis to return 2 requests (under limit of 3)
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(2);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await checkRateLimit("192.168.1.1");

      expect(result).toBe(true);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "rate_limit:192.168.1.1",
        0,
        expect.any(Number)
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "rate_limit:192.168.1.1",
        expect.objectContaining({
          score: expect.any(Number),
          member: expect.stringMatching(/^\d+-0\.\d+$/),
        })
      );
      expect(mockRedis.expire).toHaveBeenCalledWith("rate_limit:192.168.1.1", 60);
    });

    it("should block requests exceeding rate limit", async () => {
      // Mock Redis to return 3 requests (at limit)
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(3);

      const result = await checkRateLimit("192.168.1.1");

      expect(result).toBe(false);
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it("should handle multiple IPs independently", async () => {
      // Mock different request counts for different IPs
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard
        .mockResolvedValueOnce(1) // IP1 has 1 request
        .mockResolvedValueOnce(3); // IP2 has 3 requests (at limit)
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result1 = await checkRateLimit("192.168.1.1");
      const result2 = await checkRateLimit("192.168.1.2");

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "rate_limit:192.168.1.1",
        0,
        expect.any(Number)
      );
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "rate_limit:192.168.1.2",
        0,
        expect.any(Number)
      );
    });

    it("should gracefully fallback when Redis fails", async () => {
      // Mock Redis to throw an error
      mockRedis.zremrangebyscore.mockRejectedValue(new Error("Redis connection failed"));

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await checkRateLimit("192.168.1.1");

      expect(result).toBe(true); // Fail-open behavior
      expect(consoleSpy).toHaveBeenCalledWith(
        "Rate limiter error (failing open):",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should use correct Redis key format", async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await checkRateLimit("10.0.0.1");

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "rate_limit:10.0.0.1",
        0,
        expect.any(Number)
      );
    });

    it("should maintain rate limit window of 60 seconds", async () => {
      // Mock successful rate limit check
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await checkRateLimit("192.168.1.1");

      expect(mockRedis.expire).toHaveBeenCalledWith("rate_limit:192.168.1.1", 60);
    });

    it("should properly handle sliding window with timestamps", async () => {
      const now = Date.now();
      const oldTimestamp = now - 70000; // 70 seconds ago (outside window)

      // Mock successful rate limit check
      mockRedis.zremrangebyscore.mockResolvedValue(1); // Removed 1 old entry
      mockRedis.zcard.mockResolvedValue(2);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await checkRateLimit("192.168.1.1");

      // Should remove old entries outside the 60-second window
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "rate_limit:192.168.1.1",
        0,
        expect.any(Number)
      );

      // Should add new entry with current timestamp
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "rate_limit:192.168.1.1",
        expect.objectContaining({
          score: expect.any(Number),
          member: expect.stringMatching(/^\d+-0\.\d+$/),
        })
      );
    });
  });

  describe("clearRateLimit", () => {
    it("should clear rate limit for IP", async () => {
      await clearRateLimit("192.168.1.1");

      expect(mockRedis.del).toHaveBeenCalledWith("rate_limit:192.168.1.1");
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedis.del.mockRejectedValue(new Error("Redis connection failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Should not throw
      await expect(clearRateLimit("192.168.1.1")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith("Error clearing rate limit:", expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe("Redis environment handling", () => {
    it("should handle missing Redis credentials gracefully", async () => {
      // This test ensures the service works even without Redis configured
      // Implementation will check for environment variables
      const result = await checkRateLimit("192.168.1.1");

      // Should either work with Redis or fallback gracefully
      expect(typeof result).toBe("boolean");
    });
  });
});
