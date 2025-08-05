export interface QuestionSummary {
  id: string;
  stem: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  options: Array<{
    label: string;
    text: string;
  }>;
  domain?: string;
}

export interface DomainBreakdown {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface SessionSummary {
  sessionId: string;
  examType: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  startedAt: string;
  completedAt: string;
  questions: QuestionSummary[];
}

export interface StudyRecommendation {
  priority: "high" | "medium" | "low";
  domain: string;
  message: string;
  actionItems: string[];
}
