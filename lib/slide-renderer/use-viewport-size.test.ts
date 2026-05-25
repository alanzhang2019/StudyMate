import { describe, expect, it } from 'vitest';

import { computeViewportPlacement } from '@/components/slide-renderer/Editor/Canvas/hooks/useViewportSize';

describe('computeViewportPlacement', () => {
  it('returns null when canvas width is zero so canvasScale is not forced to 0', () => {
    expect(
      computeViewportPlacement({
        canvasWidth: 0,
        canvasHeight: 400,
        canvasPercentage: 90,
        viewportRatio: 0.5625,
        viewportSize: 1000,
      }),
    ).toBeNull();
  });

  it('returns null when canvas height is zero so canvasScale is not forced to 0', () => {
    expect(
      computeViewportPlacement({
        canvasWidth: 800,
        canvasHeight: 0,
        canvasPercentage: 90,
        viewportRatio: 0.5625,
        viewportSize: 1000,
      }),
    ).toBeNull();
  });
});
