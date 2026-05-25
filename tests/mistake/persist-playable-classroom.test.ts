import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Scene, Stage } from '@/lib/types/stage';
import { persistPlayableClassroom } from '@/lib/mistake/openmaic/persist-playable-classroom';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function createStage(): Stage {
  return {
    id: 'stage-123',
    name: '解方程',
    description: '错题讲解',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    style: 'professional',
    interactiveMode: false,
  };
}

function createScenes(): Scene[] {
  return [
    {
      id: 'scene-1',
      stageId: 'stage-123',
      type: 'slide',
      title: '第一步',
      order: 1,
      content: {
        type: 'slide',
        canvas: {
          id: 'slide-1',
          viewportSize: 1000,
          viewportRatio: 0.5625,
          theme: {
            backgroundColor: '#ffffff',
            themeColors: ['#5b9bd5'],
            fontColor: '#333333',
            fontName: 'Microsoft YaHei',
            outline: { color: '#d14424', width: 2, style: 'solid' },
            shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
          },
          elements: [],
          background: { type: 'solid', color: '#ffffff' },
        },
      },
      actions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
}

describe('persistPlayableClassroom', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it('posts the first playable classroom snapshot to /api/classroom', async () => {
    const stage = createStage();
    const scenes = createScenes();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, id: 'stage-123', url: 'http://localhost/classroom/stage-123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await persistPlayableClassroom({
      stage,
      scenes,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/classroom',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          scenes,
        }),
      }),
    );
  });

  it('throws when classroom snapshot persistence fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Failed to store classroom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      persistPlayableClassroom({
        stage: createStage(),
        scenes: createScenes(),
      }),
    ).rejects.toThrow('Failed to store classroom');
  });
});
