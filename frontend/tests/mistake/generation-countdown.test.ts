import { describe, expect, it } from 'vitest';

import {
  computeFirstPageEstimateSeconds,
  getFirstPageReadyCountdownCopy,
} from '@/app/generation-preview/components/generation-countdown';

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

  it('uses classroom-entry copy once the first page is ready', () => {
    expect(getFirstPageReadyCountdownCopy()).toEqual({
      displayText: '正在进入教室...',
      subText: '即将开始播放',
    });
  });
});
