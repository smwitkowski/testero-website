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
