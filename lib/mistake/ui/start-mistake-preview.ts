import { buildMistakeGenerationSession } from '@/lib/mistake/openmaic/build-generation-session';
import type { MistakeImageExtraction } from '@/lib/mistake/ocr/types';
import { createMistakeSession } from '@/lib/mistake/session/client';

export async function startMistakePreview(input: {
  extraction: MistakeImageExtraction;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  studentName?: string;
  grade?: number;
  teachingStyle?: string;
  studentProfileId?: string;
}) {
  const created = await createMistakeSession({
    studentProfileId: input.studentProfileId,
    source: 'photo',
    ocr: input.extraction,
    confirmed: {
      problemText: input.problemText,
      ...(input.studentAnswer ? { studentAnswer: input.studentAnswer } : {}),
      ...(input.correctAnswer ? { correctAnswer: input.correctAnswer } : {}),
    },
    status: 'draft',
  });

  const generationSession = buildMistakeGenerationSession({
    mistakeSessionId: created.session.id,
    input: {
      grade: input.grade || 4,
      subject: 'math',
      source: 'photo',
      problemText: input.problemText,
      ...(input.studentAnswer ? { studentAnswer: input.studentAnswer } : {}),
      ...(input.correctAnswer ? { correctAnswer: input.correctAnswer } : {}),
      studentName: input.studentName,
      teachingStyle: input.teachingStyle,
    },
  });

  sessionStorage.setItem('generationSession', JSON.stringify(generationSession));
  return created.session.id;
}
