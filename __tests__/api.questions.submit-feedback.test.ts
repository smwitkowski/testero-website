/**
 * @jest-environment node
 */
import { POST } from "@/app/api/questions/submit/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock the dependencies
jest.mock("@/lib/supabase/server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("POST /api/questions/submit - Feedback Response", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
  });

  it("should return correct feedback structure with isCorrect, correctOptionKey, and explanationText", async () => {
    // Mock options query - returns A (incorrect) and B (correct)
    const eqOptMock = jest.fn().mockResolvedValue({
      data: [
        { id: 1, label: "A", is_correct: false },
        { id: 2, label: "B", is_correct: true },
      ],
      error: null,
    });
    const selectOptMock = jest.fn(() => ({ eq: eqOptMock }));
    
    // Mock explanations query
    const singleExpMock = jest.fn().mockResolvedValue({
      data: { text: "exp" },
      error: null,
    });
    const selectExpMock = jest.fn(() => ({
      eq: jest.fn(() => ({ single: singleExpMock })),
    }));

    // Mock question metadata fetch for practice_attempts
    const singleQuestionMock = jest.fn().mockResolvedValue({
      data: { topic: "Cardiology", difficulty: 3 },
      error: null,
    });
    const selectQuestionMock = jest.fn(() => ({
      eq: jest.fn(() => ({ single: singleQuestionMock })),
    }));

    // Mock practice_attempts insert
    const insertMock = jest.fn().mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });

    // Chain the from() calls in order: options, explanations, questions, practice_attempts
    mockSupabase.from
      .mockReturnValueOnce({ select: selectOptMock }) // options
      .mockReturnValueOnce({ select: selectExpMock }) // explanations
      .mockReturnValueOnce({ select: selectQuestionMock }) // questions
      .mockReturnValueOnce({ insert: insertMock }); // practice_attempts

    const req = new Request("http://localhost/api/questions/submit", {
      method: "POST",
      body: JSON.stringify({ questionId: "123", selectedOptionKey: "B" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      isCorrect: true,
      correctOptionKey: "B",
      explanationText: "exp",
    });
  });
});

