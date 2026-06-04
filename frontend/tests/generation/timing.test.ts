import { describe, expect, it, vi } from 'vitest';

import { createGenerationTiming } from '@/lib/generation/timing';

describe('createGenerationTiming', () => {
  it('records stage durations with an injected clock', () => {
    const log = vi.fn();
    let now = 1000;
    const timing = createGenerationTiming('generation_preview', {
      now: () => now,
      log,
    });

    timing.start('outline_stream', { sceneOrder: 1 });
    now = 2500;
    const record = timing.end('outline_stream', { status: 'ok' });

    expect(record).toMatchObject({
      label: 'generation_preview',
      name: 'outline_stream',
      durationMs: 1500,
      metadata: {
        sceneOrder: 1,
        status: 'ok',
      },
    });
    expect(log).toHaveBeenCalledWith('[GenerationTiming] generation_preview.outline_stream 1500ms', {
      sceneOrder: 1,
      status: 'ok',
    });
  });

  it('redacts sensitive metadata and full text-like values', () => {
    const log = vi.fn();
    let now = 0;
    const timing = createGenerationTiming('remaining_generation', {
      now: () => now,
      log,
    });

    timing.start('scene_2_tts_action', {
      apiKey: 'secret-key',
      ttsBaseUrl: 'https://example.com',
      text: '完整讲解文本不能出现在日志里',
      problemText: '题目不能出现在日志里',
      textLength: 12,
      providerId: 'voxcpm-tts',
    });
    now = 42;
    const record = timing.end('scene_2_tts_action');

    expect(record.metadata).toEqual({
      apiKey: '[redacted]',
      ttsBaseUrl: '[redacted]',
      text: '[redacted]',
      problemText: '[redacted]',
      textLength: 12,
      providerId: 'voxcpm-tts',
    });
  });

  it('wraps async work and logs failures before rethrowing', async () => {
    const log = vi.fn();
    let now = 10;
    const timing = createGenerationTiming('generation_preview', {
      now: () => now,
      log,
    });

    await expect(
      timing.time('first_scene_actions', async () => {
        now = 60;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(timing.records()).toMatchObject([
      {
        name: 'first_scene_actions',
        durationMs: 50,
        metadata: { status: 'error', error: 'boom' },
      },
    ]);
  });

  it('prints a summary with totals and the slowest stage', () => {
    const log = vi.fn();
    let now = 0;
    const timing = createGenerationTiming('generation_preview', {
      now: () => now,
      log,
    });

    timing.start('outline_stream');
    now = 20;
    timing.end('outline_stream');
    timing.start('first_scene_content');
    now = 70;
    timing.end('first_scene_content');

    const summary = timing.summary();

    expect(summary).toEqual({
      label: 'generation_preview',
      totalDurationMs: 70,
      measuredDurationMs: 70,
      slowestStage: {
        name: 'first_scene_content',
        durationMs: 50,
      },
      stageCount: 2,
      stages: [
        { name: 'outline_stream', durationMs: 20 },
        { name: 'first_scene_content', durationMs: 50 },
      ],
    });
    expect(log).toHaveBeenCalledWith('[GenerationTimingSummary] generation_preview', summary);
  });
});
