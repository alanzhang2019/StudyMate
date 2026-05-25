import type { MistakeImageExtraction, MistakeImageExtractionDraft } from './types';

function normalizeText(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeExtraction(
  draft: MistakeImageExtractionDraft,
): MistakeImageExtraction {
  const problemText = normalizeText(draft.problemText);

  return {
    problemText: problemText ?? '',
    ...(normalizeText(draft.studentAnswer)
      ? { studentAnswer: normalizeText(draft.studentAnswer) }
      : {}),
    ...(normalizeText(draft.correctAnswerCandidate)
      ? { correctAnswerCandidate: normalizeText(draft.correctAnswerCandidate) }
      : {}),
    confidence: Math.max(0, Math.min(1, draft.confidence ?? 0.5)),
    needsUserConfirmation: true,
    ...(draft.rawModelText ? { rawModelText: draft.rawModelText } : {}),
  };
}
