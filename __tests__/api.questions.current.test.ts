/** @jest-environment node */
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/questions/current/route";

let serverSupabaseMock: any = { auth: { getUser: jest.fn() }, from: jest.fn() };

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => serverSupabaseMock),
}));

describe("GET /api/questions/current", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("success case - questions with explanations", () => {
    it("returns 200 with question that has explanations", async () => {
      const mockUser = { id: "user-123" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock questions query with explanations inner join
      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
        { id: "q2", stem: "Question 2", explanations: [{ id: "e2" }] },
        { id: "q3", stem: "Question 3", explanations: [{ id: "e3" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      // Mock options query
      const eqMock = jest.fn().mockResolvedValue({
        data: [
          { id: "opt1", label: "A", text: "Option A" },
          { id: "opt2", label: "B", text: "Option B" },
        ],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.question_text).toBeDefined();
      expect(data.options).toBeDefined();
      expect(Array.isArray(data.options)).toBe(true);
      // Verify the select was called with explanations inner join
      expect(selectMockQ).toHaveBeenCalledWith("id, stem, explanations!inner(id)");
      // Verify is_diagnostic_eligible filter is always applied
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
    });

    it("never returns questions without explanations", async () => {
      const mockUser = { id: "user-456" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock questions query - only questions WITH explanations should be returned
      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
        { id: "q2", stem: "Question 2", explanations: [{ id: "e2" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      // Mock options query
      const eqMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Verify returned question has explanations (mocked data ensures this)
      expect(data.id).toBeDefined();
      // The inner join filter ensures only questions with explanations are in the result set
      expect(questionsData.some((q) => q.id === data.id && q.explanations.length > 0)).toBe(true);
      // Verify is_diagnostic_eligible filter is always applied
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
    });
  });

  describe("empty case - no questions with explanations", () => {
    it("returns 404 with clear error message when no eligible questions exist", async () => {
      const mockUser = { id: "user-789" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock questions query returning empty array (no questions with explanations)
      const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const req = new NextRequest("http://localhost/api/questions/current");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("No eligible questions with explanations.");
      expect(selectMockQ).toHaveBeenCalledWith("id, stem, explanations!inner(id)");
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
    });

    it("logs info message when no eligible questions exist", async () => {
      const mockUser = { id: "user-999" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const req = new NextRequest("http://localhost/api/questions/current");
      await GET(req);

      expect(console.info).toHaveBeenCalledWith(
        "No eligible questions with explanations for user",
        { userId: mockUser.id, sampleLimit: 50 }
      );
    });

    it("returns 404 when query returns null", async () => {
      const mockUser = { id: "user-null" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const limitMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const req = new NextRequest("http://localhost/api/questions/current");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("No eligible questions with explanations.");
    });
  });

  describe("authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/questions/current");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Authentication required. Please log in to access questions.");
    });
  });

  describe("query parameter filters", () => {
    it("filters by topic when topic parameter is provided", async () => {
      const mockUser = { id: "user-topic" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqTopicMock = jest.fn(() => ({ limit: limitMock }));
      const eqEligibleMock = jest.fn(() => ({ eq: eqTopicMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current?topic=Cardiology");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
      expect(eqTopicMock).toHaveBeenCalledWith("topic", "Cardiology");
    });

    it("filters by difficulty when difficulty parameter is provided", async () => {
      const mockUser = { id: "user-difficulty" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqDifficultyMock = jest.fn(() => ({ limit: limitMock }));
      const eqEligibleMock = jest.fn(() => ({ eq: eqDifficultyMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current?difficulty=3");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
      expect(eqDifficultyMock).toHaveBeenCalledWith("difficulty", 3);
    });

    it("applies topic and difficulty filters together with AND semantics", async () => {
      const mockUser = { id: "user-combined" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqDifficultyMock = jest.fn(() => ({ limit: limitMock }));
      const eqTopicMock = jest.fn(() => ({ eq: eqDifficultyMock }));
      const eqEligibleMock = jest.fn(() => ({ eq: eqTopicMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current?topic=Cardiology&difficulty=2");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
      expect(eqTopicMock).toHaveBeenCalledWith("topic", "Cardiology");
      expect(eqDifficultyMock).toHaveBeenCalledWith("difficulty", 2);
    });

    it("uses non-inner join when hasExplanation=false", async () => {
      const mockUser = { id: "user-no-explanation" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqEligibleMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current?hasExplanation=false");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(selectMockQ).toHaveBeenCalledWith("id, stem, explanations(id)");
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
    });

    it("returns 400 for invalid difficulty (out of range)", async () => {
      const mockUser = { id: "user-invalid" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/questions/current?difficulty=6");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid difficulty (must be 1-5)");
    });

    it("returns 400 for invalid difficulty (below range)", async () => {
      const mockUser = { id: "user-invalid-low" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/questions/current?difficulty=0");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid difficulty (must be 1-5)");
    });

    it("returns 400 for invalid difficulty (non-numeric)", async () => {
      const mockUser = { id: "user-invalid-nan" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/questions/current?difficulty=abc");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid difficulty (must be 1-5)");
    });

    it("always applies is_diagnostic_eligible filter even with query params", async () => {
      const mockUser = { id: "user-always-eligible" };
      serverSupabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const questionsData = [
        { id: "q1", stem: "Question 1", explanations: [{ id: "e1" }] },
      ];
      const limitMock = jest.fn().mockResolvedValue({ data: questionsData, error: null });
      const eqDifficultyMock = jest.fn(() => ({ limit: limitMock }));
      const eqTopicMock = jest.fn(() => ({ eq: eqDifficultyMock }));
      const eqEligibleMock = jest.fn(() => ({ eq: eqTopicMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqEligibleMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({
        data: [{ id: "opt1", label: "A", text: "Option A" }],
        error: null,
      });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest("http://localhost/api/questions/current?topic=Cardiology&difficulty=2&hasExplanation=true");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(eqEligibleMock).toHaveBeenCalledWith("is_diagnostic_eligible", true);
      expect(eqTopicMock).toHaveBeenCalledWith("topic", "Cardiology");
      expect(eqDifficultyMock).toHaveBeenCalledWith("difficulty", 2);
    });
  });
});

