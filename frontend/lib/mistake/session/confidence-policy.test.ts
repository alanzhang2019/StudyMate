import { describe, expect, it } from 'vitest';

import { shouldSkipConfirmation } from './confidence-policy';

describe('shouldSkipConfirmation', () => {
  it('skips confirmation when confidence is high and core fields are present', () => {
    expect(
      shouldSkipConfirmation({
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswerCandidate: '63',
        confidence: 0.94,
        needsUserConfirmation: false,
      }),
    ).toBe(true);
  });

  it('requires confirmation when confidence is low', () => {
    expect(
      shouldSkipConfirmation({
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswerCandidate: '63',
        confidence: 0.61,
        needsUserConfirmation: true,
      }),
    ).toBe(false);
  });

  it('requires confirmation when problem text is empty', () => {
    expect(
      shouldSkipConfirmation({
        problemText: '  ',
        confidence: 0.98,
        needsUserConfirmation: false,
      }),
    ).toBe(false);
  });
});
