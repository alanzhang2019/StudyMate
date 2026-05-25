export interface MistakeImageExtraction {
  problemText: string;
  studentAnswer?: string;
  correctAnswerCandidate?: string;
  confidence: number;
  needsUserConfirmation: boolean;
  rawModelText?: string;
}

export interface MistakeImageExtractionDraft {
  problemText?: string;
  studentAnswer?: string;
  correctAnswerCandidate?: string;
  confidence?: number;
  rawModelText?: string;
}

export interface ExtractImageOptions {
  grade?: number;
  subject: 'math';
}
