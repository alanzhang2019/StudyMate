export type InputSource = "photo" | "manual" | "upload" | "integration";

export type Subject = "math" | "cpp";

export type MathMistakeCode =
  | "carry_mistake"
  | "borrow_mistake"
  | "operator_confusion"
  | "bracket_order_error"
  | "unit_conversion_error"
  | "concept_gap";

export type CppMistakeCode =
  | "compile_error"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_format"
  | "concept_gap";

export type MistakeCode = MathMistakeCode | CppMistakeCode;

export type CppVerdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "MLE" | "PE";

export type CppProblemType =
  | "dp"
  | "greedy"
  | "brute"
  | "graph"
  | "string"
  | "math"
  | "other";

export interface ProblemInput {
  grade: number;
  subject: Subject;
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  // cpp 扩展字段（subject=cpp 时使用）
  verdict?: CppVerdict;
  problemType?: CppProblemType;
  title?: string;
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
