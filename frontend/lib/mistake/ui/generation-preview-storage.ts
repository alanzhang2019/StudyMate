import type { GenerationSessionState } from '@/app/generation-preview/types';

const GENERATION_SESSION_KEY = 'generationSession';

export function saveGenerationPreviewSession(session: GenerationSessionState) {
  const serialized = JSON.stringify(session);
  sessionStorage.setItem(GENERATION_SESSION_KEY, serialized);
  localStorage.setItem(GENERATION_SESSION_KEY, serialized);
}

export function loadGenerationPreviewSession(): GenerationSessionState | null {
  const saved =
    sessionStorage.getItem(GENERATION_SESSION_KEY) || localStorage.getItem(GENERATION_SESSION_KEY);
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as GenerationSessionState;
  } catch {
    return null;
  }
}

export function clearGenerationPreviewSession() {
  sessionStorage.removeItem(GENERATION_SESSION_KEY);
  localStorage.removeItem(GENERATION_SESSION_KEY);
}