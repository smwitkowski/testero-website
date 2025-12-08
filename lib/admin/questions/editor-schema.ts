import { z } from "zod";

const AnswerSchema = z.object({
  id: z.string().uuid().optional(),
  choice_label: z.enum(["A", "B", "C", "D"]),
  choice_text: z.string().min(1, "Answer text required"),
  is_correct: z.boolean(),
  explanation_text: z.string().optional(),
});

export const QuestionUpdateSchema = z
  .object({
    domain_id: z.string().uuid("Invalid domain ID"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    status: z.enum(["ACTIVE", "DRAFT", "RETIRED"] as const),
    review_status: z.enum([
      "UNREVIEWED",
      "GOOD",
      "NEEDS_ANSWER_FIX",
      "NEEDS_EXPLANATION_FIX",
      "RETIRED",
    ] as const),
    review_notes: z.string().nullable(),
    stem: z.string().min(10, "Question stem must be at least 10 characters"),
    answers: z.array(AnswerSchema).length(4, "Exactly 4 answers required"),
    explanation_text: z.string().optional(),
    doc_links: z.array(z.string().url("Invalid URL")).optional(),
  })
  .refine(
    (data) => {
      const correctCount = data.answers.filter((a) => a.is_correct).length;
      return correctCount === 1;
    },
    {
      message: "Exactly one answer must be marked as correct",
      path: ["answers"],
    }
  )
  .refine(
    (data) => {
      // Skip explanation check for retired questions
      if (data.status === "RETIRED") {
        return true;
      }
      // At least the correct answer should have an explanation
      const correctAnswer = data.answers.find((a) => a.is_correct);
      return correctAnswer?.explanation_text && correctAnswer.explanation_text.trim().length > 0;
    },
    {
      message: "The correct answer must have an explanation",
      path: ["answers"],
    }
  );

export type QuestionUpdateInput = z.infer<typeof QuestionUpdateSchema>;
