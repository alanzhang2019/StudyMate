import { describe, expect, it } from 'vitest';

import { computeFirstPageEstimateSeconds } from '@/app/generation-preview/components/generation-countdown';

describe('computeFirstPageEstimateSeconds', () => {
  it('ignores actions time because the preview navigates away once first-page content is ready', () => {
    expect(computeFirstPageEstimateSeconds(['outline', 'slide-content', 'actions'])).toBe(48);
  });

  it('adds agent generation only when that step is actually active before slide-content', () => {
    expect(
      computeFirstPageEstimateSeconds([
        'outline',
        'agent-generation',
        'slide-content',
        'actions',
      ]),
    ).toBe(63);
  });
});
