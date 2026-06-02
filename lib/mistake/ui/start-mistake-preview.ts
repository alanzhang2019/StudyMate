import type { GenerationSessionState } from '@/app/generation-preview/types';
import { buildMistakeClassroomRequirement } from '@/lib/mistake/openmaic/build-requirement';
import type { MistakeImageExtraction } from '@/lib/mistake/ocr/types';
import { createMistakeSession } from '@/lib/mistake/session/client';
import { saveGenerationPreviewSession } from '@/lib/mistake/ui/generation-preview-storage';

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
  console.log('[startMistakePreview] Creating session with:', {
    studentProfileId: input.studentProfileId,
    source: 'photo',
    ocrProblemText: input.extraction.problemText,
    confirmedProblemText: input.problemText,
  });

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

  console.log('[startMistakePreview] Session created:', {
    sessionId: created.session.id,
    hasLiveUrl: !!created.liveUrl,
    liveUrl: created.liveUrl,
  });

  const generationSession: GenerationSessionState = {
    sessionId: created.session.id,
    requirements: {
      requirement: buildMistakeClassroomRequirement({
        grade: input.grade || 4,
        subject: 'math',
        source: 'photo',
        problemText: input.problemText,
        ...(input.studentAnswer ? { studentAnswer: input.studentAnswer } : {}),
        ...(input.correctAnswer ? { correctAnswer: input.correctAnswer } : {}),
        studentName: input.studentName,
        teachingStyle: input.teachingStyle,
      }),
      webSearch: false,
      interactiveMode: false,
      userNickname: input.studentName,
    },
    pdfText: '',
    sceneOutlines: [],
    currentStep: 'generating',
    previewPhase: 'preparing',
    mistakeSessionId: created.session.id,
  };

  saveGenerationPreviewSession(generationSession);
  return created.session.id;
}
