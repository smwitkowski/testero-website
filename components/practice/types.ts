export interface Option {
  id: string;
  label: string;
  text: string;
}

export interface QuestionData {
  id: string;
  question_text: string;
  options: Option[];
}

export interface QuestionFeedback {
  isCorrect: boolean;
  correctOptionKey: string;
  explanationsByOptionKey: Record<string, string | null>;
}