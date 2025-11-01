/** @jest-environment node */
import { NextRequest } from "next/server";

let serverSupabaseMock: any = { auth: { getUser: jest.fn() }, from: jest.fn() };
let clientSupabaseMock: any = { from: jest.fn() };

jest.mock("../lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => serverSupabaseMock),
}));

jest.mock("../lib/supabase/client", () => ({
  supabase: clientSupabaseMock,
}));

import { POST as waitlistPOST } from "../app/api/waitlist/route";
import { GET as listGET } from "../app/api/questions/route";
import { GET as currentGET } from "../app/api/questions/current/route";
import { GET as idGET } from "../app/api/questions/[id]/route";
import { POST as submitPOST } from "../app/api/questions/submit/route";
import { GET as diagnosticGET, POST as diagnosticPOST } from "../app/api/diagnostic/route";

describe("API routes", () => {
  beforeEach(() => {
    serverSupabaseMock.auth.getUser.mockReset();
    serverSupabaseMock.from.mockReset();
    clientSupabaseMock.from.mockReset();
    (global as any).fetch = jest.fn();
    process.env.LOOPS_API_KEY = "test";
  });

  describe("waitlist POST", () => {
    it("valid submission", async () => {
      const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
      serverSupabaseMock.from.mockReturnValue({ insert: insertMock });
      (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const req = new NextRequest("http://localhost/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "a@test.com", examType: "GME" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: "success" });
      expect(serverSupabaseMock.from).toHaveBeenCalledWith("waitlist");
    });

    it("invalid email returns 400", async () => {
      const req = new NextRequest("http://localhost/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(400);
    });

    it("handles duplicate email", async () => {
      const insertMock = jest.fn().mockResolvedValue({ data: null, error: { code: "23505" } });
      serverSupabaseMock.from.mockReturnValue({ insert: insertMock });
      (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const req = new NextRequest("http://localhost/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "dup@test.com", examType: "GME" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(409);
    });
  });

  describe("questions list", () => {
    it("returns question ids", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const orderMock = jest.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });
      const selectMock = jest.fn(() => ({ order: orderMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const res = await listGET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.questionIds).toEqual(["1", "2"]);
      // Assert all IDs are strings
      json.questionIds.forEach((id: unknown) => {
        expect(typeof id).toBe("string");
      });
    });

    it("requires auth", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await listGET();
      expect(res.status).toBe(401);
    });
  });

  describe("current question", () => {
    it("returns latest question", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      // Mock the questions query
      const questionsData = [
        { id: 5, stem: "q" },
        { id: 6, stem: "q2" },
        { id: 7, stem: "q3" },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const selectMockQ = jest.fn(() => ({ limit: limitMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      // Mock the options query
      const eqMock = jest
        .fn()
        .mockResolvedValue({ data: [{ id: 1, label: "A", text: "t" }], error: null });
      const selectMockO = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const res = await currentGET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.question_text).toBeDefined();
      expect(data.options.length).toBe(1);
      // Assert question ID is string
      expect(typeof data.id).toBe("string");
      // Assert all option IDs are strings
      data.options.forEach((option: { id: unknown }) => {
        expect(typeof option.id).toBe("string");
      });
    });
  });

  describe("question by id", () => {
    it("returns question data", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const singleMock = jest
        .fn()
        .mockResolvedValue({ data: { id: 9, stem: "what?" }, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({ data: [{ id: 10, label: "A", text: "Answer" }], error: null });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/9");
      const res = await idGET(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.id).toBe("9");
      // Assert question ID is string
      expect(typeof json.id).toBe("string");
      // Assert all option IDs are strings
      json.options.forEach((option: { id: unknown }) => {
        expect(typeof option.id).toBe("string");
      });
    });
  });

  describe("submit answer", () => {
    it("evaluates answer", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
      const eqOptMock = jest.fn().mockResolvedValue({
        data: [
          { id: 1, label: "A", is_correct: false },
          { id: 2, label: "B", is_correct: true },
        ],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const singleExpMock = jest.fn().mockResolvedValue({ data: { text: "exp" }, error: null });
      const selectExpMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleExpMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectExpMock });

      // Mock question metadata fetch for practice_attempts
      const singleQuestionMock = jest.fn().mockResolvedValue({ data: { topic: "Cardiology", difficulty: 3 }, error: null });
      const selectQuestionMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleQuestionMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectQuestionMock });

      // Mock practice_attempts insert
      const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
      serverSupabaseMock.from.mockReturnValueOnce({ insert: insertMock });

      const req = new Request("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({ questionId: "123", selectedOptionKey: "B" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await submitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.isCorrect).toBe(true);
      expect(json.explanationText).toBe("exp");

      // Verify practice_attempts insert was called with correct data
      expect(insertMock).toHaveBeenCalledWith({
        user_id: "user-123",
        question_id: 123,
        selected_label: "B",
        is_correct: true,
        topic: "Cardiology",
        difficulty: 3,
      });
    });

    it("persists attempt with incorrect answer", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-456" } }, error: null });
      const eqOptMock = jest.fn().mockResolvedValue({
        data: [
          { id: 1, label: "A", is_correct: true },
          { id: 2, label: "B", is_correct: false },
        ],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const singleExpMock = jest.fn().mockResolvedValue({ data: { text: "explanation" }, error: null });
      const selectExpMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleExpMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectExpMock });

      // Mock question metadata fetch
      const singleQuestionMock = jest.fn().mockResolvedValue({ data: { topic: "Neurology", difficulty: 5 }, error: null });
      const selectQuestionMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleQuestionMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectQuestionMock });

      // Mock practice_attempts insert
      const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 2 }], error: null });
      serverSupabaseMock.from.mockReturnValueOnce({ insert: insertMock });

      const req = new Request("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({ questionId: "456", selectedOptionKey: "B" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await submitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.isCorrect).toBe(false);

      // Verify practice_attempts insert was called with incorrect answer
      expect(insertMock).toHaveBeenCalledWith({
        user_id: "user-456",
        question_id: 456,
        selected_label: "B",
        is_correct: false,
        topic: "Neurology",
        difficulty: 5,
      });
    });

    it("returns feedback even if practice_attempts insert fails", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-789" } }, error: null });
      const eqOptMock = jest.fn().mockResolvedValue({
        data: [
          { id: 1, label: "A", is_correct: false },
          { id: 2, label: "B", is_correct: true },
        ],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const singleExpMock = jest.fn().mockResolvedValue({ data: { text: "exp" }, error: null });
      const selectExpMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleExpMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectExpMock });

      // Mock question metadata fetch
      const singleQuestionMock = jest.fn().mockResolvedValue({ data: { topic: "Pulmonology", difficulty: 2 }, error: null });
      const selectQuestionMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleQuestionMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectQuestionMock });

      // Mock practice_attempts insert failure
      const insertMock = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: "Database connection failed", code: "23505" } 
      });
      serverSupabaseMock.from.mockReturnValueOnce({ insert: insertMock });

      const req = new Request("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({ questionId: "789", selectedOptionKey: "B" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await submitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.isCorrect).toBe(true);
      expect(json.explanationText).toBe("exp");
    });

    it("handles missing question metadata gracefully", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-999" } }, error: null });
      const eqOptMock = jest.fn().mockResolvedValue({
        data: [
          { id: 1, label: "A", is_correct: true },
        ],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const singleExpMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const selectExpMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleExpMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectExpMock });

      // Mock question metadata fetch returning null
      const singleQuestionMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const selectQuestionMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleQuestionMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectQuestionMock });

      // Mock practice_attempts insert
      const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 3 }], error: null });
      serverSupabaseMock.from.mockReturnValueOnce({ insert: insertMock });

      const req = new Request("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({ questionId: "999", selectedOptionKey: "A" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await submitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.isCorrect).toBe(true);

      // Verify practice_attempts insert with null topic/difficulty
      expect(insertMock).toHaveBeenCalledWith({
        user_id: "user-999",
        question_id: 999,
        selected_label: "A",
        is_correct: true,
        topic: null,
        difficulty: null,
      });
    });

    it("missing fields", async () => {
      const req = new Request("http://localhost/api/questions/submit", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      const res = await submitPOST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("diagnostic route", () => {
    beforeEach(() => {
      const isMock = jest.fn(() => Promise.resolve({ error: null }));
      const ltMock = jest.fn(() => ({ is: isMock }));
      const deleteMock = jest.fn(() => ({ lt: ltMock }));
      serverSupabaseMock.from.mockReturnValue({ delete: deleteMock });
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    });
    it("rejects invalid action", async () => {
      const req = new Request("http://localhost/api/diagnostic", {
        method: "POST",
        body: JSON.stringify({ action: "bad" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await diagnosticPOST(req);
      expect(res.status).toBe(400);
    });

    it("requires session id for GET", async () => {
      const req = new Request("http://localhost/api/diagnostic");
      const res = await diagnosticGET(req as any);
      expect(res.status).toBe(400);
    });
  });
});
