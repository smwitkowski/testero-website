/** @jest-environment node */
import { NextRequest } from "next/server";

// Mock Supabase before importing the route
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => mockSupabase),
}));

// Import route after mocks are set up
import { POST } from "@/app/api/study-path/route";

describe("/api/study-path - TDD RED Phase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.from.mockReset();

    // Default mock for database operations (will fail silently)
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Table not found" },
          }),
        }),
      }),
    });
  });

  describe("Study Path Generation", () => {
    it("should generate study path recommendations for authenticated user", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      // Create request with diagnostic data
      const diagnosticData = {
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
        body: JSON.stringify(diagnosticData),
      });

      // Call the API (will fail - endpoint doesn't exist yet)
      const response = await POST(request);
      const data = await response.json();

      // Should return study path recommendations
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("recommendations");
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(data.recommendations.length).toBeGreaterThan(0);

      // Each recommendation should have required fields
      const firstRec = data.recommendations[0];
      expect(firstRec).toHaveProperty("domain");
      expect(firstRec).toHaveProperty("priority");
      expect(firstRec).toHaveProperty("topics");
      expect(firstRec).toHaveProperty("estimatedTime");
    });

    it("should prioritize weak domains in recommendations", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      const diagnosticData = {
        score: 60,
        domains: [
          { domain: "Neural Networks", correct: 1, total: 5, percentage: 20 }, // Weakest
          { domain: "Machine Learning Basics", correct: 4, total: 5, percentage: 80 }, // Strong
          { domain: "Model Optimization", correct: 2, total: 4, percentage: 50 }, // Medium
        ],
      };

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify(diagnosticData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Neural Networks should be first priority (weakest domain)
      expect(data.recommendations[0].domain).toBe("Neural Networks");
      expect(data.recommendations[0].priority).toBe("high");
    });

    it("should require authentication", async () => {
      // Mock no user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify({ score: 50, domains: [] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty("error", "Authentication required");
    });

    it("should validate request body", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      // Invalid request - missing domains
      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify({ score: 50 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error", "Invalid request data");
    });

    it("should generate different recommendations based on score level", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      // Test with high score (80%)
      const highScoreData = {
        score: 80,
        domains: [
          { domain: "Neural Networks", correct: 4, total: 5, percentage: 80 },
          { domain: "Machine Learning Basics", correct: 4, total: 5, percentage: 80 },
        ],
      };

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify(highScoreData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should recommend advanced topics for high scorers
      expect(
        data.recommendations.some((r: any) =>
          r.topics.some(
            (t: string) =>
              t.toLowerCase().includes("advanced") || t.toLowerCase().includes("optimization")
          )
        )
      ).toBe(true);
    });

    it("should save study path to database for tracking", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      // Mock database insert
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: "study-path-id" },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const diagnosticData = {
        score: 50,
        domains: [{ domain: "Neural Networks", correct: 2, total: 5, percentage: 40 }],
      };

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify(diagnosticData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should save to study_paths table
      expect(mockSupabase.from).toHaveBeenCalledWith("study_paths");
      expect(mockInsert).toHaveBeenCalled();
      expect(data).toHaveProperty("studyPathId");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      // Mock database error
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: JSON.stringify({
          score: 50,
          domains: [{ domain: "Test", correct: 1, total: 2, percentage: 50 }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return recommendations even if save fails
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("recommendations");
      expect(data).not.toHaveProperty("studyPathId"); // But no ID since save failed
    });

    it("should handle malformed JSON", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/study-path", {
        method: "POST",
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
    });
  });
});
