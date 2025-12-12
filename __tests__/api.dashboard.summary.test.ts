/**
 * @jest-environment node
 */
import { GET } from "@/app/api/dashboard/summary/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DashboardSummarySuccessResponse, ErrorResponse } from "@/app/api/dashboard/summary/route";

// Mock the dependencies
jest.mock("@/lib/supabase/server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("GET /api/dashboard/summary", () => {
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

  it("should return 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("should return 400 when examKey is missing", async () => {
    const req = new Request("http://localhost:3000/api/dashboard/summary");
    const response = await GET(req);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(data.error).toContain("examKey query parameter is required");
  });

  it("should return 400 when examKey is unsupported", async () => {
    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=mock");
    const response = await GET(req);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(data.error).toContain("Unsupported exam key");
  });

  it("should return empty state when no completed PMLE diagnostics exist", async () => {
    // Mock count query - returns 0
    const countMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValueOnce(countMock());

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as DashboardSummarySuccessResponse;

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.data.examKey).toBe("pmle");
    expect(data.data.currentReadinessScore).toBe(0);
    expect(data.data.currentReadinessTier).toBeNull();
    expect(data.data.lastDiagnosticDate).toBeNull();
    expect(data.data.lastDiagnosticSessionId).toBeNull();
    expect(data.data.totalDiagnosticsCompleted).toBe(0);
    expect(data.data.hasCompletedDiagnostic).toBe(false);
  });

  it("should return readiness summary for single completed PMLE diagnostic", async () => {
    const sessionId = "session-pmle-1";
    const completedAt = "2024-01-15T10:00:00Z";

    // Mock count query - returns 1
    const countMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock latest session query - returns one session
    const latestSessionMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: sessionId,
                      completed_at: completedAt,
                      question_count: 10,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    // Mock diagnostic responses - 8/10 correct = 80% score
    const responsesMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: true },
            { is_correct: false },
            { is_correct: false },
          ],
          error: null,
        }),
      }),
    });

    // Chain all the from() calls in the exact order they're called in the route
    mockSupabase.from
      .mockReturnValueOnce(countMock()) // diagnostics_sessions (count)
      .mockReturnValueOnce(latestSessionMock()) // diagnostics_sessions (latest)
      .mockReturnValueOnce(responsesMock()); // diagnostic_responses

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as DashboardSummarySuccessResponse;

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.data.examKey).toBe("pmle");
    expect(data.data.currentReadinessScore).toBe(80);
    expect(data.data.currentReadinessTier).not.toBeNull();
    expect(data.data.currentReadinessTier?.id).toBe("ready"); // 80% falls in ready tier (70-84)
    expect(data.data.currentReadinessTier?.label).toBe("Ready");
    expect(data.data.lastDiagnosticDate).toBe(completedAt);
    expect(data.data.lastDiagnosticSessionId).toBe(sessionId);
    expect(data.data.totalDiagnosticsCompleted).toBe(1);
    expect(data.data.hasCompletedDiagnostic).toBe(true);
  });

  it("should handle error when fetching diagnostic count fails", async () => {
    // Mock count query - returns error
    const countMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              count: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValueOnce(countMock());

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to fetch diagnostic data");
  });

  it("should handle error when fetching latest session fails", async () => {
    // Mock count query - returns 1
    const countMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock latest session query - returns error
    const latestSessionMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database error" },
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabase.from
      .mockReturnValueOnce(countMock())
      .mockReturnValueOnce(latestSessionMock());

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to fetch diagnostic data");
  });

  it("should handle case when count > 0 but no session found (edge case)", async () => {
    // Mock count query - returns 1
    const countMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    });

    // Mock latest session query - returns null (edge case)
    const latestSessionMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
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
        }),
      }),
    });

    mockSupabase.from
      .mockReturnValueOnce(countMock())
      .mockReturnValueOnce(latestSessionMock());

    const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
    const response = await GET(req);
    const data = (await response.json()) as DashboardSummarySuccessResponse;

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.data.hasCompletedDiagnostic).toBe(false);
    expect(data.data.currentReadinessScore).toBe(0);
    expect(data.data.totalDiagnosticsCompleted).toBe(1); // Count was 1, but no session found
  });

  it("should calculate correct tier for different score ranges", async () => {
    const testCases = [
      { correct: 3, total: 10, expectedTier: "low", expectedScore: 30 }, // < 40
      { correct: 5, total: 10, expectedTier: "building", expectedScore: 50 }, // 40-69
      { correct: 7, total: 10, expectedTier: "ready", expectedScore: 70 }, // 70-84
      { correct: 9, total: 10, expectedTier: "strong", expectedScore: 90 }, // 85+
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      // Mock count query
      const countMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockResolvedValue({
                count: 1,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock latest session query
      const latestSessionMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: "session-1",
                        completed_at: "2024-01-15T10:00:00Z",
                        question_count: testCase.total,
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      // Mock responses with correct/incorrect pattern
      const responses = Array.from({ length: testCase.total }, (_, i) => ({
        is_correct: i < testCase.correct,
      }));

      const responsesMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: responses,
            error: null,
          }),
        }),
      });

      mockSupabase.from
        .mockReturnValueOnce(countMock())
        .mockReturnValueOnce(latestSessionMock())
        .mockReturnValueOnce(responsesMock());

      const req = new Request("http://localhost:3000/api/dashboard/summary?examKey=pmle");
      const response = await GET(req);
      const data = (await response.json()) as DashboardSummarySuccessResponse;

      expect(response.status).toBe(200);
      expect(data.data.currentReadinessScore).toBe(testCase.expectedScore);
      expect(data.data.currentReadinessTier?.id).toBe(testCase.expectedTier);
    }
  });
});



