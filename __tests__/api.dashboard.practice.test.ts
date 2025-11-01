/**
 * @jest-environment node
 */
import { GET } from "@/app/api/dashboard/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock the dependencies
jest.mock("@/lib/supabase/server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("GET /api/dashboard - Practice Stats", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "test-user-123" } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe("Practice stats calculation", () => {
    it("should return practice stats from practice_attempts", async () => {
      // Mock diagnostic sessions (empty for this test)
      const diagnosticFromMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Mock practice_attempts count queries
      // Count queries return { count, error } when awaited
      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          count: 10,
          error: null,
        }),
      });

      const practiceCorrectCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 7,
              error: null,
            }),
          }),
        }),
      });

      // Mock last practice date query
      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { answered_at: "2024-01-15T10:00:00Z" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticFromMock()) // diagnostics_sessions
        .mockReturnValueOnce(practiceCountMock()) // practice_attempts (total count)
        .mockReturnValueOnce(practiceCorrectCountMock()) // practice_attempts (correct count)
        .mockReturnValueOnce(practiceLastDateMock()); // practice_attempts (last date)

      const req = new Request("http://localhost:3000/api/dashboard");
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.data.practice.totalQuestionsAnswered).toBe(10);
      expect(data.data.practice.correctAnswers).toBe(7);
      expect(data.data.practice.accuracyPercentage).toBe(70);
      expect(data.data.practice.lastPracticeDate).toBe("2024-01-15T10:00:00Z");
    });

    it("should calculate accuracy correctly (7/10 = 70%)", async () => {
      // Mock diagnostic sessions (empty)
      const diagnosticFromMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Mock practice counts: 10 total, 7 correct
      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          count: 10,
          error: null,
        }),
      });

      const practiceCorrectCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 7,
              error: null,
            }),
          }),
        }),
      });

      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { answered_at: "2024-01-15T10:00:00Z" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticFromMock())
        .mockReturnValueOnce(practiceCountMock())
        .mockReturnValueOnce(practiceCorrectCountMock())
        .mockReturnValueOnce(practiceLastDateMock());

      const response = await GET();
      const data = await response.json();

      expect(data.data.practice.accuracyPercentage).toBe(70);
    });

    it("should return lastPracticeDate from latest attempt", async () => {
      const diagnosticFromMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      });

      const practiceCorrectCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 4,
              error: null,
            }),
          }),
        }),
      });

      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { answered_at: "2024-01-20T14:30:00Z" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticFromMock())
        .mockReturnValueOnce(practiceCountMock())
        .mockReturnValueOnce(practiceCorrectCountMock())
        .mockReturnValueOnce(practiceLastDateMock());

      const response = await GET();
      const data = await response.json();

      expect(data.data.practice.lastPracticeDate).toBe("2024-01-20T14:30:00Z");
    });

    it("should use practice accuracy in 60/40 readiness formula with diagnostic", async () => {
      // Mock diagnostic sessions with score
      const diagnosticSessionsMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "session-1",
                      exam_type: "GME",
                      question_count: 10,
                      completed_at: "2024-01-15T10:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Mock diagnostic responses (8/10 correct = 80%)
      const diagnosticResponsesMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: false },
              { session_id: "session-1", is_correct: false },
            ],
            error: null,
          }),
        }),
      });

      // Mock practice stats (7/10 = 70%)
      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          count: 10,
          error: null,
        }),
      });

      const practiceCorrectCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 7,
              error: null,
            }),
          }),
        }),
      });

      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { answered_at: "2024-01-15T10:00:00Z" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticSessionsMock()) // diagnostics_sessions
        .mockReturnValueOnce(diagnosticResponsesMock()) // diagnostic_responses
        .mockReturnValueOnce(practiceCountMock()) // practice_attempts (total)
        .mockReturnValueOnce(practiceCorrectCountMock()) // practice_attempts (correct)
        .mockReturnValueOnce(practiceLastDateMock()); // practice_attempts (last date)

      const response = await GET();
      const data = await response.json();

      // Expected: 0.6 * 80 + 0.4 * 70 = 48 + 28 = 76
      expect(data.data.readinessScore).toBe(76);
    });

    it("should fall back to diagnostic-only discount when no practice", async () => {
      // Mock diagnostic sessions with score
      const diagnosticSessionsMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "session-1",
                      exam_type: "GME",
                      question_count: 10,
                      completed_at: "2024-01-15T10:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Mock diagnostic responses (8/10 correct = 80%)
      const diagnosticResponsesMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: true },
              { session_id: "session-1", is_correct: false },
              { session_id: "session-1", is_correct: false },
            ],
            error: null,
          }),
        }),
      });

      // Mock practice stats (no attempts)
      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
      });

      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticSessionsMock()) // diagnostics_sessions
        .mockReturnValueOnce(diagnosticResponsesMock()) // diagnostic_responses
        .mockReturnValueOnce(practiceCountMock()) // practice_attempts (total)
        .mockReturnValueOnce(practiceLastDateMock()); // practice_attempts (last date)

      const response = await GET();
      const data = await response.json();

      // Expected: 80 * 0.8 = 64 (diagnostic-only discount)
      expect(data.data.readinessScore).toBe(64);
    });

    it("should return zero practice stats when no attempts exist", async () => {
      const diagnosticFromMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      // Mock practice stats (no attempts)
      const practiceCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
      });

      const practiceCorrectCountMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      });

      const practiceLastDateMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(diagnosticFromMock())
        .mockReturnValueOnce(practiceCountMock())
        .mockReturnValueOnce(practiceCorrectCountMock())
        .mockReturnValueOnce(practiceLastDateMock());

      const response = await GET();
      const data = await response.json();

      expect(data.data.practice.totalQuestionsAnswered).toBe(0);
      expect(data.data.practice.correctAnswers).toBe(0);
      expect(data.data.practice.accuracyPercentage).toBe(0);
      expect(data.data.practice.lastPracticeDate).toBeNull();
    });
  });
});

