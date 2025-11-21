/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/diagnostic/summary/[sessionId]/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPmleDomainConfig } from "@/lib/constants/pmle-blueprint";

// Mock the dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/constants/pmle-blueprint");
jest.mock("@/lib/auth/require-subscriber", () => ({
  requireSubscriber: jest.fn().mockResolvedValue(null),
}));

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("GET /api/diagnostic/summary/[sessionId]", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe("Session validation", () => {
    it("should return 404 when session does not exist", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const req = new Request("http://localhost:3000/api/diagnostic/summary/test-session-123");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Session not found" });
    });

    it("should return 410 when session has expired", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: new Date().toISOString(),
          expires_at: expiredDate.toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
          question_count: 5,
        },
        error: null,
      });

      const req = new Request("http://localhost:3000/api/diagnostic/summary/test-session-123");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data).toEqual({ error: "Session expired" });
    });

    it("should return 400 when session is not completed", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: null, // Not completed
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
          question_count: 5,
        },
        error: null,
      });

      // Add matching anonymous session ID to pass authorization check
      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Session not completed yet" });
    });
  });

  describe("Authorization checks", () => {
    it("should return 403 for unauthorized user session", async () => {
      // Mock a logged-in user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-789", email: "test@example.com" } },
        error: null,
      });

      // Session belongs to different user
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: "user-999", // Different user
          anonymous_session_id: null,
          completed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
          question_count: 5,
        },
        error: null,
      });

      const req = new Request("http://localhost:3000/api/diagnostic/summary/test-session-123");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: "Unauthorized to access this session" });
    });

    it("should return 403 for wrong anonymous session ID", async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
          question_count: 5,
        },
        error: null,
      });

      // Wrong anonymous session ID in query param
      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=wrong-id"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: "Invalid anonymous session identifier" });
    });
  });

  describe("Summary calculation", () => {
    beforeEach(() => {
      // Setup chain for questions query
      const questionsQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      // Setup chain for topics query
      const topicsQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
      };

      // Configure mockSupabase to return different chains for different tables
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "diagnostics_sessions") {
          return mockSupabase; // Original chain for sessions
        } else if (table === "diagnostic_questions") {
          return questionsQuery;
        } else if (table === "questions") {
          return topicsQuery;
        }
        return mockSupabase;
      });

      // Mock the second query for questions with responses
      (questionsQuery as any).eq.mockResolvedValue({
        data: [
          {
            id: 1,
            stem: "What is machine learning?",
            options: [
              { label: "A", text: "A type of AI" },
              { label: "B", text: "A database" },
              { label: "C", text: "A programming language" },
              { label: "D", text: "A hardware device" },
            ],
            correct_label: "A",
            original_question_id: 101,
            diagnostic_responses: [
              {
                selected_label: "A",
                is_correct: true,
                responded_at: new Date().toISOString(),
              },
            ],
          },
          {
            id: 2,
            stem: "What is TensorFlow?",
            options: [
              { label: "A", text: "A database" },
              { label: "B", text: "A framework" },
              { label: "C", text: "An OS" },
              { label: "D", text: "A language" },
            ],
            correct_label: "B",
            original_question_id: 102,
            diagnostic_responses: [
              {
                selected_label: "C",
                is_correct: false,
                responded_at: new Date().toISOString(),
              },
            ],
          },
          {
            id: 3,
            stem: "What is BigQuery?",
            options: [
              { label: "A", text: "A data warehouse" },
              { label: "B", text: "A web server" },
              { label: "C", text: "A mobile app" },
              { label: "D", text: "A game engine" },
            ],
            correct_label: "A",
            original_question_id: 103,
            diagnostic_responses: [
              {
                selected_label: "A",
                is_correct: true,
                responded_at: new Date().toISOString(),
              },
            ],
          },
        ],
        error: null,
      });

      // Mock the third query for question topics
      (topicsQuery as any).in.mockResolvedValue({
        data: [
          { id: 101, topic: "Machine Learning Fundamentals" },
          { id: 102, topic: "Machine Learning Fundamentals" },
          { id: 103, topic: "Data Engineering" },
        ],
        error: null,
      });
    });

    it("should calculate correct score and statistics", async () => {
      const completedAt = new Date().toISOString();
      const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: completedAt,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: startedAt,
          question_count: 3,
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toEqual({
        sessionId: "test-session-123",
        examType: "Google Professional ML Engineer",
        totalQuestions: 3,
        correctAnswers: 2,
        score: 67, // 2/3 * 100 rounded
        startedAt,
        completedAt,
        questions: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            stem: "What is machine learning?",
            userAnswer: "A",
            correctAnswer: "A",
            isCorrect: true,
          }),
          expect.objectContaining({
            id: 2,
            stem: "What is TensorFlow?",
            userAnswer: "C",
            correctAnswer: "B",
            isCorrect: false,
          }),
          expect.objectContaining({
            id: 3,
            stem: "What is BigQuery?",
            userAnswer: "A",
            correctAnswer: "A",
            isCorrect: true,
          }),
        ]),
      });
    });

    it("should calculate domain breakdown correctly", async () => {
      const completedAt = new Date().toISOString();
      const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: completedAt,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: startedAt,
          question_count: 3,
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.domainBreakdown).toEqual(
        expect.arrayContaining([
          {
            domain: "Machine Learning Fundamentals",
            correct: 1,
            total: 2,
            percentage: 50,
          },
          {
            domain: "Data Engineering",
            correct: 1,
            total: 1,
            percentage: 100,
          },
        ])
      );
    });

    it("should handle questions with no responses", async () => {
      // Override the questions query to return a question with no response
      const questionsQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              id: 1,
              stem: "Unanswered question?",
              options: [
                { label: "A", text: "Option A" },
                { label: "B", text: "Option B" },
              ],
              correct_label: "A",
              original_question_id: 101,
              diagnostic_responses: [], // No response
            },
          ],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "diagnostic_questions") {
          return questionsQuery;
        }
        return mockSupabase;
      });

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: new Date().toISOString(),
          question_count: 1,
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.questions[0]).toEqual({
        id: 1,
        stem: "Unanswered question?",
        options: [
          { label: "A", text: "Option A" },
          { label: "B", text: "Option B" },
        ],
        userAnswer: "",
        correctAnswer: "A",
        isCorrect: false,
      });
    });

    it("should use canonical domain_code from snapshots without joining questions table", async () => {
      const mockGetPmleDomainConfig = getPmleDomainConfig as jest.MockedFunction<typeof getPmleDomainConfig>;
      
      // Mock domain config lookups
      mockGetPmleDomainConfig.mockImplementation((code: string) => {
        const configs: Record<string, { domainCode: string; displayName: string; weight: number }> = {
          'ARCHITECTING_LOW_CODE_ML_SOLUTIONS': {
            domainCode: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
            displayName: 'Architecting Low-Code ML Solutions',
            weight: 0.125,
          },
          'SERVING_AND_SCALING_MODELS': {
            domainCode: 'SERVING_AND_SCALING_MODELS',
            displayName: 'Serving & Scaling Models',
            weight: 0.195,
          },
        };
        return configs[code];
      });

      const completedAt = new Date().toISOString();
      const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // Setup questions query with domain_code populated (canonical PMLE)
      const questionsQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              id: 1,
              stem: "Canonical question 1",
              options: [
                { label: "A", text: "Answer A" },
                { label: "B", text: "Answer B" },
              ],
              correct_label: "A",
              original_question_id: "q1",
              domain_id: "domain-uuid-1",
              domain_code: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS",
              diagnostic_responses: [
                {
                  selected_label: "A",
                  is_correct: true,
                  responded_at: new Date().toISOString(),
                },
              ],
            },
            {
              id: 2,
              stem: "Canonical question 2",
              options: [
                { label: "A", text: "Answer A" },
                { label: "B", text: "Answer B" },
              ],
              correct_label: "B",
              original_question_id: "q2",
              domain_id: "domain-uuid-1",
              domain_code: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS",
              diagnostic_responses: [
                {
                  selected_label: "A",
                  is_correct: false,
                  responded_at: new Date().toISOString(),
                },
              ],
            },
            {
              id: 3,
              stem: "Canonical question 3",
              options: [
                { label: "A", text: "Answer A" },
                { label: "B", text: "Answer B" },
              ],
              correct_label: "A",
              original_question_id: "q3",
              domain_id: "domain-uuid-2",
              domain_code: "SERVING_AND_SCALING_MODELS",
              diagnostic_responses: [
                {
                  selected_label: "A",
                  is_correct: true,
                  responded_at: new Date().toISOString(),
                },
              ],
            },
          ],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "diagnostics_sessions") {
          return mockSupabase;
        } else if (table === "diagnostic_questions") {
          return questionsQuery;
        }
        // Should NOT query questions table for canonical sessions
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      mockSupabase.single.mockResolvedValue({
        data: {
          id: "test-session-123",
          user_id: null,
          anonymous_session_id: "anon-456",
          completed_at: completedAt,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          exam_type: "Google Professional ML Engineer",
          started_at: startedAt,
          question_count: 3,
        },
        error: null,
      });

      const req = new Request(
        "http://localhost:3000/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-456"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Verify domain breakdown uses canonical domain codes from snapshots
      expect(data.domainBreakdown).toEqual(
        expect.arrayContaining([
          {
            domain: "Architecting Low-Code ML Solutions",
            correct: 1,
            total: 2,
            percentage: 50,
          },
          {
            domain: "Serving & Scaling Models",
            correct: 1,
            total: 1,
            percentage: 100,
          },
        ])
      );

      // Verify getPmleDomainConfig was called with domain codes from snapshots
      expect(mockGetPmleDomainConfig).toHaveBeenCalledWith("ARCHITECTING_LOW_CODE_ML_SOLUTIONS");
      expect(mockGetPmleDomainConfig).toHaveBeenCalledWith("SERVING_AND_SCALING_MODELS");

      // Verify questions table was NOT queried (no join needed for canonical sessions)
      // The summary endpoint should use domain_code directly from diagnostic_questions snapshots
      const questionsTableQueries = mockSupabase.from.mock.calls.filter(
        (call) => call[0] === "questions"
      );
      // For canonical sessions with domain_code, we should not query questions table
      expect(questionsTableQueries.length).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should return 400 for invalid session ID", async () => {
      const req = new Request("http://localhost:3000/api/diagnostic/summary/");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid session ID" });
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.single.mockRejectedValue(new Error("Database connection failed"));

      const req = new Request("http://localhost:3000/api/diagnostic/summary/test-session-123");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
    });
  });
});
