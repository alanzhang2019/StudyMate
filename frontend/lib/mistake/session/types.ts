import type { ExplanationSummary } from '@/lib/mistake/ui/types';

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
  studentProfileId?: string;
  source: 'photo' | 'upload';
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
  studentProfileId?: string;
  source: 'photo' | 'upload';
  imageUrl?: string;
  ocr: MistakeSession['ocr'];
  confirmed: MistakeSession['confirmed'];
  status: MistakeSessionStatus;
}
