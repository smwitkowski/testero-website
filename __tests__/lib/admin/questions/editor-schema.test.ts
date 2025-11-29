/**
 * @jest-environment node
 */
import { QuestionUpdateSchema } from "@/lib/admin/questions/editor-schema";

describe("QuestionUpdateSchema", () => {
  const validPayload = {
    domain_id: "123e4567-e89b-12d3-a456-426614174000",
    difficulty: "MEDIUM" as const,
    status: "ACTIVE" as const,
    review_status: "GOOD" as const,
    review_notes: "Looks good",
    stem: "This is a test question stem that is long enough",
    answers: [
      { choice_label: "A" as const, choice_text: "Answer A", is_correct: true },
      { choice_label: "B" as const, choice_text: "Answer B", is_correct: false },
      { choice_label: "C" as const, choice_text: "Answer C", is_correct: false },
      { choice_label: "D" as const, choice_text: "Answer D", is_correct: false },
    ],
    explanation_text: "This is the explanation",
    doc_links: ["https://example.com/doc"],
    reasoning_style: null,
  };

  it("should validate a valid payload", () => {
    const result = QuestionUpdateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("should reject payload with invalid domain_id", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      domain_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("domain_id");
    }
  });

  it("should reject payload with stem too short", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      stem: "Short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("stem");
    }
  });

  it("should reject payload with wrong number of answers", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      answers: validPayload.answers.slice(0, 3),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("answers");
    }
  });

  it("should reject payload with no correct answer", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      answers: validPayload.answers.map((a) => ({ ...a, is_correct: false })),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const refineError = result.error.issues.find((issue) => issue.path.includes("answers"));
      expect(refineError).toBeDefined();
    }
  });

  it("should reject payload with multiple correct answers", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      answers: validPayload.answers.map((a, i) => ({
        ...a,
        is_correct: i < 2,
      })),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const refineError = result.error.issues.find((issue) => issue.path.includes("answers"));
      expect(refineError).toBeDefined();
    }
  });

  it("should reject payload with empty answer text", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      answers: [
        ...validPayload.answers.slice(0, 1),
        { choice_label: "B" as const, choice_text: "", is_correct: false },
        ...validPayload.answers.slice(2),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const answerError = result.error.issues.find((issue) =>
        issue.path.some((p) => typeof p === "number")
      );
      expect(answerError).toBeDefined();
    }
  });

  it("should reject payload with invalid URL in doc_links", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      doc_links: ["not-a-url"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const urlError = result.error.issues.find((issue) => issue.path.includes("doc_links"));
      expect(urlError).toBeDefined();
    }
  });

  it("should accept payload with null review_notes", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      review_notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("should accept payload without doc_links", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      doc_links: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("should accept payload with empty doc_links array", () => {
    const result = QuestionUpdateSchema.safeParse({
      ...validPayload,
      doc_links: [],
    });
    expect(result.success).toBe(true);
  });
});
