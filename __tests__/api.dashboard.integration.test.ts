/**
 * @jest-environment node
 */
import { GET } from "@/app/api/dashboard/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SuccessResponse } from "@/app/api/dashboard/route";

// Mock the dependencies
jest.mock("@/lib/supabase/server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("GET /api/dashboard - Practice Stats Integration with Diagnostic", () => {
  let mockSupabase: any;
  const testUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: testUserId } },
          error: null,
        }),
      },
      from: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
  });

  it("should return non-zero practice stats and readiness reflects practice when diagnostic present", async () => {
    // Mock diagnostic sessions - one completed session
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
                    started_at: "2024-01-10T10:00:00Z",
                    completed_at: "2024-01-10T11:00:00Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    // Mock diagnostic responses - 8/10 correct = 80% score
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

    // Mock practice_attempts total count query - returns count: 1
    // Chain: from().select().eq() where select returns chainable with eq()
    const practiceTotalCountMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          count: 1,
          error: null,
        }),
      }),
    });

    // Mock practice_attempts correct count query - returns count: 1
    // Chain: from().select().eq().eq() where select returns chainable
    const practiceCorrectCountMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        }),
      }),
    });

    // Mock practice_attempts last date query - returns one row with answered_at
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

    // Chain all the from() calls in the exact order they're called in the route
    mockSupabase.from
      .mockReturnValueOnce(diagnosticSessionsMock()) // diagnostics_sessions
      .mockReturnValueOnce(diagnosticResponsesMock()) // diagnostic_responses
      .mockReturnValueOnce(practiceTotalCountMock()) // practice_attempts (total count)
      .mockReturnValueOnce(practiceCorrectCountMock()) // practice_attempts (correct count)
      .mockReturnValueOnce(practiceLastDateMock()); // practice_attempts (last date)

    const req = new Request("http://localhost:3000/api/dashboard");
    const response = await GET();
    const data = (await response.json()) as SuccessResponse;

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");

    // Verify practice stats are non-zero
    expect(data.data.practice.totalQuestionsAnswered).toBe(1);
    expect(data.data.practice.correctAnswers).toBe(1);
    expect(data.data.practice.accuracyPercentage).toBe(100);
    expect(data.data.practice.lastPracticeDate).toBe("2024-01-15T10:00:00Z");

    // Verify readiness score reflects both diagnostic (80%) and practice (100%)
    // Expected: Math.round(0.6 * 80 + 0.4 * 100) = Math.round(48 + 40) = 88
    expect(data.data.readinessScore).toBe(88);
  });
});

