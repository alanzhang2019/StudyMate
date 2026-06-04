export interface MistakeClassroomInput {
  sessionId?: string;
  grade: number;
  subject: 'math';
  source: 'photo' | 'manual';
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  studentName?: string;
  teachingStyle?: string;
}
