import { describe, expect, it } from 'vitest';

import { normalizeExtraction } from './normalize-extraction';

describe('normalizeExtraction', () => {
  it('trims whitespace, preserves optional fields, and defaults confirmation to true', () => {
    const result = normalizeExtraction({
      problemText: '  36 + 27 = ?  ',
      studentAnswer: ' 53 ',
      correctAnswerCandidate: ' 63 ',
      confidence: 0.92,
      rawModelText: 'raw',
    });

    expect(result).toEqual({
      problemText: '36 + 27 = ?',
      studentAnswer: '53',
      correctAnswerCandidate: '63',
      confidence: 0.92,
      needsUserConfirmation: true,
      rawModelText: 'raw',
    });
  });

  it('drops empty optional fields and clamps confidence into 0-1 range', () => {
    const result = normalizeExtraction({
      problemText: '\n24 个苹果平均分给 6 个小朋友，每人几个？\n',
      studentAnswer: '   ',
      correctAnswerCandidate: '',
      confidence: 3,
    });

    expect(result).toEqual({
      problemText: '24 个苹果平均分给 6 个小朋友，每人几个？',
      confidence: 1,
      needsUserConfirmation: true,
    });
  });

  it('keeps an empty problemText as a confirmation draft instead of throwing', () => {
    const result = normalizeExtraction({
      problemText: '   ',
      studentAnswer: '53',
      confidence: 0.2,
      rawModelText: '{"studentAnswer":"53"}',
    });

    expect(result).toEqual({
      problemText: '',
      studentAnswer: '53',
      confidence: 0.2,
      needsUserConfirmation: true,
      rawModelText: '{"studentAnswer":"53"}',
    });
  });
});
