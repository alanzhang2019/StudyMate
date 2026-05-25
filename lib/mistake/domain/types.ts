export type InputSource = "photo" | "manual";

export type MistakeCode =
  | "carry_mistake"
  | "borrow_mistake"
  | "operator_confusion"
  | "bracket_order_error"
  | "unit_conversion_error"
  | "concept_gap";

export interface ProblemInput {
  grade: number;
  subject: "math";
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
}

export interface PracticeSuggestion {
  prompt: string;
  answer: string;
}

export interface ParentSummary {
  headline: string;
  nextStep: string;
}

export interface DiagnosisResult {
  normalizedProblemText: string;
  guessedMistake: MistakeCode;
  confidence: number;
  explanationForChild: string;
  knowledgePoint: string;
  practiceSuggestions: PracticeSuggestion[];
  parentSummary: ParentSummary;
}

export interface AnalyzeSessionResponse {
  input: ProblemInput;
  diagnosis: DiagnosisResult;
}
