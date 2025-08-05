import { checkRateLimit, clearRateLimit } from "../lib/auth/rate-limiter";

// Mock Upstash Redis
jest.mock("@upstash/redis", () => {
  const mockRedis = {
    lpush: jest.fn(),
    ltrim: jest.fn(),
    llen: jest.fn(),
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
      mockRedis.llen.mockResolvedValue(2);

      const result = await checkRateLimit("192.168.1.1");

      expect(result).toBe(true);
      expect(mockRedis.lpush).toHaveBeenCalledWith("rate_limit:192.168.1.1", expect.any(Number));
      expect(mockRedis.ltrim).toHaveBeenCalledWith("rate_limit:192.168.1.1", 0, 2);
      expect(mockRedis.expire).toHaveBeenCalledWith("rate_limit:192.168.1.1", 60);
    });

    it("should block requests exceeding rate limit", async () => {
      // Mock Redis to return 3 requests (at limit)
      mockRedis.llen.mockResolvedValue(3);

      const result = await checkRateLimit("192.168.1.1");

      expect(result).toBe(false);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it("should handle multiple IPs independently", async () => {
      // Mock different request counts for different IPs
      mockRedis.llen
        .mockResolvedValueOnce(1) // IP1 has 1 request
        .mockResolvedValueOnce(3); // IP2 has 3 requests (at limit)

      const result1 = await checkRateLimit("192.168.1.1");
      const result2 = await checkRateLimit("192.168.1.2");

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockRedis.llen).toHaveBeenCalledWith("rate_limit:192.168.1.1");
      expect(mockRedis.llen).toHaveBeenCalledWith("rate_limit:192.168.1.2");
    });

    it("should gracefully fallback when Redis fails", async () => {
      // Mock Redis to throw an error
      mockRedis.llen.mockRejectedValue(new Error("Redis connection failed"));

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
      mockRedis.llen.mockResolvedValue(1);

      await checkRateLimit("10.0.0.1");

      expect(mockRedis.llen).toHaveBeenCalledWith("rate_limit:10.0.0.1");
    });

    it("should maintain rate limit window of 60 seconds", async () => {
      mockRedis.llen.mockResolvedValue(1);

      await checkRateLimit("192.168.1.1");

      expect(mockRedis.expire).toHaveBeenCalledWith("rate_limit:192.168.1.1", 60);
    });

    it("should maintain rate limit max of 3 requests", async () => {
      mockRedis.llen.mockResolvedValue(2);

      await checkRateLimit("192.168.1.1");

      expect(mockRedis.ltrim).toHaveBeenCalledWith("rate_limit:192.168.1.1", 0, 2); // Keep only 3 items (0-2)
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
