import type { MistakeImageExtraction } from '@/lib/mistake/ocr/types';

const HIGH_CONFIDENCE_THRESHOLD = 0.9;

function normalizeText(value?: string) {
  return value?.trim() || '';
}

export function shouldSkipConfirmation(extraction: MistakeImageExtraction): boolean {
  const problemText = normalizeText(extraction.problemText);

  if (!problemText) {
    return false;
  }

  if (extraction.needsUserConfirmation) {
    return false;
  }

  return (extraction.confidence ?? 0) >= HIGH_CONFIDENCE_THRESHOLD;
}
