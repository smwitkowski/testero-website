/** @jest-environment node */

import { POST } from "@/app/api/study-path/route";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

// Mock rate limiter
jest.mock("@/lib/auth/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

import { checkRateLimit } from "@/lib/auth/rate-limiter";

describe("/api/study-path", () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);
    // Default to allowing rate limit
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
  });

  describe("Rate Limiting", () => {
    it("should return 429 when rate limit is exceeded", async () => {
      // Mock rate limit exceeded
      (checkRateLimit as jest.Mock).mockResolvedValue(false);

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          score: 40,
          domains: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Too many requests");
      expect(checkRateLimit).toHaveBeenCalledWith("192.168.1.1");
    });
  });

  describe("Authentication", () => {
    it("should require authentication and return 401 for anonymous users", async () => {
      // Mock no user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: 40,
          domains: [{ domain: "Test Domain", correct: 2, total: 5, percentage: 40 }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });
  });

  describe("Study Path Generation", () => {
    beforeEach(() => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      });

      // Mock database insert
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "study-path-123" },
              error: null,
            }),
          }),
        }),
      });
    });

    it("should return study path recommendations based on diagnostic data", async () => {
      const inputData = {
        score: 40,
        domains: [
          { domain: "Neural Networks", correct: 1, total: 3, percentage: 33 },
          { domain: "Machine Learning Basics", correct: 2, total: 4, percentage: 50 },
          { domain: "Model Optimization", correct: 1, total: 3, percentage: 33 },
        ],
      };

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.recommendations).toHaveLength(3);

      // Check recommendations are sorted by priority (lowest percentage first)
      expect(data.recommendations[0].domain).toBe("Neural Networks");
      expect(data.recommendations[0].priority).toBe("high");
      expect(data.recommendations[0].estimatedTime).toBe("2-3 weeks");

      expect(data.recommendations[1].domain).toBe("Model Optimization");
      expect(data.recommendations[1].priority).toBe("high");

      expect(data.recommendations[2].domain).toBe("Machine Learning Basics");
      expect(data.recommendations[2].priority).toBe("medium");
    });

    it("should prioritize domains correctly based on performance", async () => {
      const testCases = [
        { percentage: 20, expectedPriority: "high" },
        { percentage: 35, expectedPriority: "high" },
        { percentage: 40, expectedPriority: "medium" },
        { percentage: 60, expectedPriority: "medium" },
        { percentage: 70, expectedPriority: "low" },
        { percentage: 90, expectedPriority: "low" },
      ];

      for (const testCase of testCases) {
        const request = new NextRequest("http://localhost:3000/api/study-path", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score: 50,
            domains: [
              {
                domain: "Test Domain",
                correct: testCase.percentage,
                total: 100,
                percentage: testCase.percentage,
              },
            ],
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.recommendations[0].priority).toBe(testCase.expectedPriority);
      }
    });

    it("should handle invalid input gracefully", async () => {
      const invalidRequest = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Missing required fields
          domains: [],
        }),
      });

      const response = await POST(invalidRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    it("should handle database errors gracefully", async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("Database error"),
            }),
          }),
        }),
      });

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: 50,
          domains: [{ domain: "Test", correct: 5, total: 10, percentage: 50 }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return recommendations even if DB save fails
      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.recommendations).toBeDefined();
      expect(data.studyPathId).toBeUndefined(); // No ID since save failed
    });
  });
});
