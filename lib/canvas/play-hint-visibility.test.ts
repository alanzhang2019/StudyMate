import { describe, expect, it } from 'vitest';

import { shouldShowCanvasPlayHint } from '@/lib/canvas/play-hint-visibility';

describe('shouldShowCanvasPlayHint', () => {
  it('hides the center play hint when lecture content is already visible', () => {
    expect(
      shouldShowCanvasPlayHint({
        showControls: true,
        engineState: 'idle',
        sceneType: 'slide',
        isLiveSession: false,
        isPendingScene: false,
        hasVisibleLectureContent: true,
      }),
    ).toBe(false);
  });

  it('still shows the center play hint for an untouched slide before playback starts', () => {
    expect(
      shouldShowCanvasPlayHint({
        showControls: true,
        engineState: 'idle',
        sceneType: 'slide',
        isLiveSession: false,
        isPendingScene: false,
        hasVisibleLectureContent: false,
      }),
    ).toBe(true);
  });

  it('hides the center play hint for paused slides that already have visible lecture content', () => {
    expect(
      shouldShowCanvasPlayHint({
        showControls: true,
        engineState: 'paused',
        sceneType: 'slide',
        isLiveSession: false,
        isPendingScene: false,
        hasVisibleLectureContent: true,
      }),
    ).toBe(false);
  });
});
