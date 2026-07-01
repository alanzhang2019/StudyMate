import type { ExplanationSummary } from '@/lib/mistake/ui/types';
import type { InputSource, Subject } from '@/lib/mistake/domain/types';

export type MistakeSessionStatus =
  | 'draft'
  | 'ready_to_generate'
  | 'waiting_first_scene'
  | 'live'
  | 'failed'
  | 'completed';

export interface ParentSummary {
  totalCount: number;
  solvedCount: number;
  needMoreReason: string;
  focusTopic: string;
}

export interface MistakeSession {
  id: string;
  subject?: Subject;
  studentProfileId?: string;
  source: InputSource;
  imageUrl?: string;
  ocr: {
    problemText: string;
    studentAnswer?: string;
    correctAnswerCandidate?: string;
    confidence?: number;
  };
  confirmed: {
    problemText: string;
    studentAnswer?: string;
    correctAnswer?: string;
  };
  classroomJobId?: string;
  classroomId?: string;
  explanationSummary?: ExplanationSummary;
  parentSummary?: ParentSummary;
  masteryStatus?: 'pending' | 'done';
  error?: string;
  status: MistakeSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMistakeSessionInput {
  subject?: Subject;
  studentProfileId?: string;
  source: InputSource;
  imageUrl?: string;
  ocr: MistakeSession['ocr'];
  confirmed: MistakeSession['confirmed'];
  status: MistakeSessionStatus;
}
