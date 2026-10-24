import type { DiagnosticQuestion, DiagnosticResult, PaidQuestionReview } from "@/lib/diagnostic/types";
export interface MockProgress {
  sessionId: string;
  status: "in_progress" | "completed";
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  totalQuestions: number;
  answeredCount: number;
  allocationNotice: string | null;
  questions: (DiagnosticQuestion & { selectedLabel: string | null })[];
}
export interface MockAttempt {
  sessionId: string; startedAt: string; deadlineAt: string; completedAt: string | null;
  score: number | null; totalQuestions: number;
}
export type MockResults = DiagnosticResult & {
  completedAt: string; timedOut: boolean; allocationNotice: string | null; review: PaidQuestionReview[];
};
