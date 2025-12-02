/**
 * @jest-environment node
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchQuestionForEditor, fetchDomainOptions } from "@/lib/admin/questions/editor-query";

describe("editor-query", () => {
  const mockSupabase = {
    from: jest.fn(),
  } as unknown as SupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchQuestionForEditor", () => {
    it("should return null when question not found", async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "No rows returned" },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchQuestionForEditor(mockSupabase, "non-existent-id");
      expect(result).toBeNull();
    });

    it("should fetch and transform question data correctly", async () => {
      const mockData = {
        id: "q1",
        exam: "GCP_PM_ML_ENG",
        domain_id: "domain-1",
        stem: "Test question stem",
        difficulty: "MEDIUM",
        status: "ACTIVE",
        review_status: "GOOD",
        review_notes: "Looks good",
        source_ref: "ref-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        exam_domains: {
          id: "domain-1",
          code: "DATA_PIPELINES",
          name: "Data Pipelines",
        },
        answers: [
          { id: "a1", choice_label: "B", choice_text: "Answer B", is_correct: false },
          { id: "a2", choice_label: "A", choice_text: "Answer A", is_correct: true },
          { id: "a3", choice_label: "C", choice_text: "Answer C", is_correct: false },
          { id: "a4", choice_label: "D", choice_text: "Answer D", is_correct: false },
        ],
        explanations: [
          {
            id: "e1",
            explanation_text: "A is correct because...",
            doc_links: ["https://example.com/doc"],
            reasoning_style: null,
          },
        ],
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchQuestionForEditor(mockSupabase, "q1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("q1");
      expect(result?.domain_code).toBe("DATA_PIPELINES");
      expect(result?.domain_name).toBe("Data Pipelines");
      expect(result?.answers).toHaveLength(4);
      expect(result?.answers[0].choice_label).toBe("A");
      expect(result?.answers[0].is_correct).toBe(true);
      expect(result?.explanation?.doc_links).toEqual(["https://example.com/doc"]);
    });

    it("should handle missing answers and fill with empty placeholders", async () => {
      const mockData = {
        id: "q1",
        exam: "GCP_PM_ML_ENG",
        domain_id: "domain-1",
        stem: "Test question",
        difficulty: null,
        status: null,
        review_status: "UNREVIEWED",
        review_notes: null,
        source_ref: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        exam_domains: {
          id: "domain-1",
          code: "DATA_PIPELINES",
          name: "Data Pipelines",
        },
        answers: [
          { id: "a1", choice_label: "A", choice_text: "Only A", is_correct: true },
        ],
        explanations: null,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchQuestionForEditor(mockSupabase, "q1");

      expect(result?.answers).toHaveLength(4);
      expect(result?.answers[0].choice_label).toBe("A");
      expect(result?.answers[1].choice_label).toBe("B");
      expect(result?.answers[1].choice_text).toBe("");
      expect(result?.answers[1].is_correct).toBe(false);
    });

    it("should handle doc_links as array", async () => {
      const mockData = {
        id: "q1",
        exam: "GCP_PM_ML_ENG",
        domain_id: "domain-1",
        stem: "Test question",
        difficulty: null,
        status: null,
        review_status: "UNREVIEWED",
        review_notes: null,
        source_ref: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        exam_domains: {
          id: "domain-1",
          code: "DATA_PIPELINES",
          name: "Data Pipelines",
        },
        answers: [],
        explanations: [
          {
            id: "e1",
            explanation_text: "Explanation",
            doc_links: ["https://example.com/doc1", "https://example.com/doc2"],
            reasoning_style: "CONCISE",
          },
        ],
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchQuestionForEditor(mockSupabase, "q1");

      expect(result?.explanation?.doc_links).toEqual([
        "https://example.com/doc1",
        "https://example.com/doc2",
      ]);
    });

    it("should throw error on database error", async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST123", message: "Database error" },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(fetchQuestionForEditor(mockSupabase, "q1")).rejects.toThrow(
        "Failed to fetch question"
      );
    });
  });

  describe("fetchDomainOptions", () => {
    it("should fetch and return domain options", async () => {
      const mockData = [
        { id: "d1", code: "DOMAIN_A", name: "Domain A" },
        { id: "d2", code: "DOMAIN_B", name: "Domain B" },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchDomainOptions(mockSupabase);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "d1", code: "DOMAIN_A", name: "Domain A" });
    });

    it("should throw error on database error", async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(fetchDomainOptions(mockSupabase)).rejects.toThrow(
        "Failed to fetch domain options"
      );
    });
  });
});
