import { describe, expect, it } from 'vitest';

import { buildMistakeGenerationSession } from './build-generation-session';

describe('buildMistakeGenerationSession', () => {
  it('builds a generation-preview session from confirmed mistake data', () => {
    const session = buildMistakeGenerationSession({
      mistakeSessionId: 'mistake-1',
      input: {
        grade: 4,
        subject: 'math',
        source: 'photo',
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswer: '63',
      },
    });

    expect(session).toMatchObject({
      sessionId: 'mistake-1',
      currentStep: 'generating',
      previewPhase: 'preparing',
      pdfText: '',
      sceneOutlines: [],
      sourceMode: 'mistake',
      mistakeSessionId: 'mistake-1',
      requirements: {
        requirement: expect.stringContaining('36 + 27 = ?'),
        webSearch: false,
        interactiveMode: false,
      },
    });
  });
});
