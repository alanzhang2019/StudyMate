import { describe, expect, it } from 'vitest';

import { shouldShowRecognizeFailure } from '@/lib/mistake/ui/recognize-state';

describe('shouldShowRecognizeFailure', () => {
  it('returns true when there is no pending recognize session', () => {
    expect(shouldShowRecognizeFailure(null)).toBe(true);
  });

  it('returns true when OCR produced an empty problem text', () => {
    expect(
      shouldShowRecognizeFailure({
        imageUrl: 'data:image/png;base64,abc',
        problemText: '   ',
        confidence: 0,
        needsUserConfirmation: true,
      }),
    ).toBe(true);
  });

  it('returns false when OCR extracted a problem text to confirm', () => {
    expect(
      shouldShowRecognizeFailure({
        imageUrl: 'data:image/png;base64,abc',
        problemText: 'x - (7/16 - 5/24) = 7/24',
        confidence: 0.7,
        needsUserConfirmation: true,
      }),
    ).toBe(false);
  });
});
