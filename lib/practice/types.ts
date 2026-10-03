import type { DiagnosticProgress, DiagnosticResult, PaidQuestionReview } from "@/lib/diagnostic/types";
export type PracticeProgress = DiagnosticProgress;
export interface PracticeAnswerResponse {
  answeredCount: number;
  totalQuestions: number;
  completed: boolean;
  feedback: {
    itemId: string;
    selectedLabel: string;
    correctLabel: string;
    isCorrect: boolean;
    explanation?: string;
    optionExplanations?: { label: string; text: string; explanation: string }[];
  };
}
export interface PracticeSummary extends DiagnosticResult { review: PaidQuestionReview[] }
export interface PracticeStartResponse { sessionId: string; href: string }
