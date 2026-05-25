import type { GenerationSessionState } from '@/app/generation-preview/types';

import { buildMistakeClassroomRequirement } from './build-requirement';
import type { MistakeClassroomInput } from './types';

interface BuildMistakeGenerationSessionParams {
  mistakeSessionId: string;
  input: MistakeClassroomInput;
}

export function buildMistakeGenerationSession(
  params: BuildMistakeGenerationSessionParams,
): GenerationSessionState {
  return {
    sessionId: params.mistakeSessionId,
    requirements: {
      requirement: buildMistakeClassroomRequirement(params.input),
      webSearch: false,
      interactiveMode: false,
      userNickname: params.input.studentName,
    },
    pdfText: '',
    sceneOutlines: [],
    currentStep: 'generating',
    previewPhase: 'preparing',
    sourceMode: 'mistake',
    mistakeSessionId: params.mistakeSessionId,
  };
}
