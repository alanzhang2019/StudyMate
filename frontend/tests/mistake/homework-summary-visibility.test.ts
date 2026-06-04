import { describe, expect, it } from 'vitest';

import { shouldShowHomeworkSummary } from '@/lib/mistake/ui/homework-summary-visibility';

describe('shouldShowHomeworkSummary', () => {
  it('hides the summary before lecture playback completes', () => {
    expect(
      shouldShowHomeworkSummary({
        hasSummary: true,
        lectureCompleted: false,
      }),
    ).toBe(false);
  });

  it('shows the summary after lecture playback completes', () => {
    expect(
      shouldShowHomeworkSummary({
        hasSummary: true,
        lectureCompleted: true,
      }),
    ).toBe(true);
  });

  it('stays hidden when there is no summary data', () => {
    expect(
      shouldShowHomeworkSummary({
        hasSummary: false,
        lectureCompleted: true,
      }),
    ).toBe(false);
  });
});
