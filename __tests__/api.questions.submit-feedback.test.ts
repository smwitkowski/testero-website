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

  it("should return correct feedback structure with isCorrect, correctOptionKey, and explanationsByOptionKey", async () => {
    // Mock options query - returns A (incorrect) and B (correct) with per-option explanations
    const eqOptMock = jest.fn().mockResolvedValue({
      data: [
        { id: 1, choice_label: "A", is_correct: false, explanation_text: "A is incorrect because..." },
        { id: 2, choice_label: "B", is_correct: true, explanation_text: "B is correct because..." },
      ],
      error: null,
    });
    const selectOptMock = jest.fn(() => ({ eq: eqOptMock }));

    // Mock question metadata fetch for practice_attempts
    const singleQuestionMock = jest.fn().mockResolvedValue({
      data: { topic: "Cardiology", difficulty: "MEDIUM" },
      error: null,
    });
    const selectQuestionMock = jest.fn(() => ({
      eq: jest.fn(() => ({ single: singleQuestionMock })),
    }));

    // Mock practice_question_attempts_v2 upsert
    const upsertV2Mock = jest.fn().mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });
    const upsertV2FromMock = {
      upsert: jest.fn().mockReturnValue({
        onConflict: jest.fn().mockReturnValue(upsertV2Mock),
      }),
    };

    // Mock practice_attempts insert (legacy)
    const insertMock = jest.fn().mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });
    const insertFromMock = {
      insert: insertMock,
    };

    // Chain the from() calls in order: answers, questions, practice_question_attempts_v2, practice_attempts
    mockSupabase.from
      .mockReturnValueOnce({ select: selectOptMock }) // answers
      .mockReturnValueOnce({ select: selectQuestionMock }) // questions
      .mockReturnValueOnce(upsertV2FromMock) // practice_question_attempts_v2
      .mockReturnValueOnce(insertFromMock); // practice_attempts (legacy)

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
      explanationsByOptionKey: {
        A: "A is incorrect because...",
        B: "B is correct because...",
      },
    });
  });
});

