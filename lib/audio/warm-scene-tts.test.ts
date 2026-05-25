import { describe, expect, it, vi, afterEach } from 'vitest';

import type { Scene } from '@/lib/types/stage';
import { warmSceneTTSWithinBudget } from './warm-scene-tts';

function createScene(): Scene {
  return {
    id: 'scene-1',
    stageId: 'stage-1',
    type: 'slide',
    title: 'Scene 1',
    order: 1,
    content: {
      type: 'slide',
      canvas: {} as never,
    },
    actions: [
      { id: 'speech-1', type: 'speech', text: '第一句讲解' },
      { id: 'laser-1', type: 'laser', elementId: 'target-1' },
      { id: 'speech-2', type: 'speech', text: '第二句讲解' },
    ],
  };
}

describe('warmSceneTTSWithinBudget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns after the warmup budget expires without blocking on pending TTS', async () => {
    vi.useFakeTimers();
    const scene = createScene();
    const generate = vi.fn().mockImplementation(() => new Promise<void>(() => {}));

    const resultPromise = warmSceneTTSWithinBudget({
      scene,
      language: 'zh-CN',
      budgetMs: 1000,
      generate,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toEqual({
      timedOut: true,
      totalSpeechActions: 2,
      failedCount: 0,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(scene.actions?.[0]).toMatchObject({ audioId: 'tts_s1_speech-1' });
    expect(scene.actions?.[2]).toMatchObject({ audioId: 'tts_s1_speech-2' });
  });

  it('reports failures when all speech warmup requests finish within budget', async () => {
    const scene = createScene();
    const generate = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('tts unavailable'));

    await expect(
      warmSceneTTSWithinBudget({
        scene,
        budgetMs: 1000,
        generate,
      }),
    ).resolves.toEqual({
      timedOut: false,
      totalSpeechActions: 2,
      failedCount: 1,
    });
  });
});
