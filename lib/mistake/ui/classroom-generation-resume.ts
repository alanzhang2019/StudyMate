export type StoredClassroomGenerationParams = {
  pdfImages?: unknown[];
  agents?: unknown[];
  userProfile?: unknown;
  languageDirective?: string;
  sourceMode?: string;
  mistakeSessionId?: string;
};

export function parseStoredClassroomGenerationParams(
  raw: string | null,
): StoredClassroomGenerationParams | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredClassroomGenerationParams | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const hasUsefulField = Boolean(
      parsed.mistakeSessionId ||
        parsed.sourceMode ||
        parsed.languageDirective ||
        (parsed.agents && parsed.agents.length > 0) ||
        (parsed.pdfImages && parsed.pdfImages.length > 0) ||
        parsed.userProfile,
    );

    return hasUsefulField ? parsed : null;
  } catch {
    return null;
  }
}

export function shouldResumeClassroomGeneration(input: {
  hasPendingOutlines: boolean;
  generationParams: StoredClassroomGenerationParams | null;
}) {
  return input.hasPendingOutlines && input.generationParams !== null;
}

export function shouldDiscardPersistedClassroomOutlines(input: {
  generationParams: StoredClassroomGenerationParams | null;
  scenesLength: number;
  outlinesLength: number;
}) {
  return input.generationParams === null && input.scenesLength > 0 && input.outlinesLength > 0;
}
