import type { AdminQuestionReviewStatus, AdminQuestionStatus } from "./filter-utils";

export interface QuestionAnswer {
  id?: string;
  choice_label: "A" | "B" | "C" | "D";
  choice_text: string;
  is_correct: boolean;
  explanation_text?: string;
}

export interface QuestionExplanation {
  explanation_text: string;
  doc_links?: string[];
  reasoning_style?: string | null;
}

export interface QuestionEditorData {
  id: string;
  exam: string;
  domain_id: string;
  domain_code: string;
  domain_name: string;
  stem: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  status: AdminQuestionStatus | null;
  review_status: AdminQuestionReviewStatus;
  review_notes: string | null;
  source_ref: string | null;
  answers: QuestionAnswer[];
  explanation: QuestionExplanation | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionUpdatePayload {
  domain_id: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: AdminQuestionStatus;
  review_status: AdminQuestionReviewStatus;
  review_notes: string | null;
  stem: string;
  answers: QuestionAnswer[];
  doc_links?: string[];
}

export interface DomainOption {
  id: string;
  code: string;
  name: string;
}
