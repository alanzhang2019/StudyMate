import type { InputSource, Subject } from '@/lib/mistake/domain/types';

export interface MistakeClassroomInput {
  sessionId?: string;
  grade: number;
  subject: Subject;
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  studentName?: string;
  teachingStyle?: string;
}
