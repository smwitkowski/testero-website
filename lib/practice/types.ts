import type { DiagnosticProgress, DiagnosticResult, QuestionReview } from "@/lib/diagnostic/types";
export type PracticeProgress = DiagnosticProgress;
export interface PracticeAnswerResponse { answeredCount: number; totalQuestions: number; completed: boolean; feedback: { itemId: string; selectedLabel: string; correctLabel: string; isCorrect: boolean } }
export interface PracticeSummary extends DiagnosticResult { review: QuestionReview[] }
export interface PracticeStartResponse { sessionId: string; href: string }
