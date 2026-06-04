import { describe, expect, it } from 'vitest';

import { needsServerAudioHydration } from '@/lib/mistake/ui/classroom-audio-hydration';

describe('needsServerAudioHydration', () => {
  it('returns true when local speech actions only have audioId', () => {
    expect(
      needsServerAudioHydration([
        {
          id: 'scene-1',
          stageId: 'classroom-1',
          type: 'slide',
          title: '第一页',
          order: 1,
          content: { type: 'slide', canvas: { id: 'c1', elements: [] } },
          actions: [
            {
              id: 'speech-1',
              type: 'speech',
              text: '同学们好',
              audioId: 'tts_s1_speech-1',
            },
          ],
        },
      ] as never),
    ).toBe(true);
  });

  it('returns false when speech actions already have audioUrl', () => {
    expect(
      needsServerAudioHydration([
        {
          id: 'scene-1',
          stageId: 'classroom-1',
          type: 'slide',
          title: '第一页',
          order: 1,
          content: { type: 'slide', canvas: { id: 'c1', elements: [] } },
          actions: [
            {
              id: 'speech-1',
              type: 'speech',
              text: '同学们好',
              audioId: 'tts_s1_speech-1',
              audioUrl: 'http://localhost/audio/demo.wav',
            },
          ],
        },
      ] as never),
    ).toBe(false);
  });
});
