import type { ExamReadinessTier } from "@/lib/readiness";

export interface DiagnosticQuestion {
  id: string;
  ordinal: number;
  stem: string;
  options: { label: string; text: string }[];
}

export interface DiagnosticProgress {
  sessionId: string;
  status: "in_progress" | "completed";
  totalQuestions: number;
  answeredCount: number;
  currentQuestion: DiagnosticQuestion | null;
}

export interface DiagnosticResult {
  sessionId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  readiness: ExamReadinessTier;
  review?: PaidQuestionReview[];
  domainBreakdown: {
    domainCode: string;
    domainName: string;
    total: number;
    correct: number;
    percentage: number;
  }[];
}

export interface DiagnosticStartResponse {
  sessionId: string;
  href: string;
}

export interface DiagnosticAnswerResponse {
  answeredCount: number;
  totalQuestions: number;
  completed: boolean;
}

/** Completed, account-owned question review. Explanations are never included. */
export interface QuestionReview {
  itemId: string;
  ordinal: number;
  stem: string;
  options: { label: string; text: string }[];
  selectedLabel: string;
  correctLabel: string;
  isCorrect: boolean;
  domainCode: string;
  domainName: string;
}

/** Paid additions are only emitted on a freshly authorized completed review. */
export interface PaidQuestionReview extends QuestionReview {
  explanation?: string;
  options: { label: string; text: string; explanation?: string }[];
}

export interface QuestionReviewSource {
  id: string;
  ordinal: number;
  stem: string;
  options: { label: string; text: string }[];
  selected_label: string;
  correct_label: string;
  is_correct: boolean;
  domain_code: string;
  domain_name: string;
}

/** Copy only public review fields, including only label/text from stored JSON. */
export function mapReview(item: QuestionReviewSource): QuestionReview {
  return {
    itemId: item.id,
    ordinal: item.ordinal,
    stem: item.stem,
    options: item.options.map(option => ({ label: option.label, text: option.text })),
    selectedLabel: item.selected_label,
    correctLabel: item.correct_label,
    isCorrect: item.is_correct,
    domainCode: item.domain_code,
    domainName: item.domain_name,
  };
}
