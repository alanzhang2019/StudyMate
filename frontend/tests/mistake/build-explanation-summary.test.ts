import { describe, expect, it } from 'vitest';

import { buildFallbackExplanationSummary } from '@/lib/mistake/ui/build-explanation-summary';

describe('buildFallbackExplanationSummary', () => {
  it('creates four fixed cards from the recognized problem payload', () => {
    const summary = buildFallbackExplanationSummary({
      problemText: '一根绳子长 2 米，剪去 80 厘米，还剩多少厘米？',
      studentAnswer: '120 厘米',
      correctAnswer: '120 厘米',
    });

    expect(summary.stuckPoint).toContain('卡');
    expect(summary.whyStuck).toContain('先');
    expect(summary.howToThink).toContain('关键');
    expect(summary.nextTimeTip).toContain('下次');
  });
});
