import { describe, expect, it } from 'vitest';

import { buildSceneFromGeneratedContent } from '@/lib/generation/scene-assembly';

describe('buildSceneFromGeneratedContent', () => {
  it('builds a first scene without actions from generated slide content', () => {
    const scene = buildSceneFromGeneratedContent(
      {
        id: 'outline-1',
        type: 'slide',
        title: '第一页',
        description: 'desc',
        keyPoints: ['a'],
        order: 1,
      },
      {
        elements: [
          {
            id: 'text-1',
            type: 'text',
            content: 'hello',
            left: 10,
            top: 10,
            width: 100,
            height: 30,
            fontSize: 18,
          },
        ],
      },
      'stage-1',
    );

    expect(scene).toMatchObject({
      stageId: 'stage-1',
      type: 'slide',
      title: '第一页',
      order: 1,
      actions: [],
      content: {
        type: 'slide',
      },
    });
    expect(scene.content.type).toBe('slide');
    if (scene.content.type === 'slide') {
      expect(scene.content.canvas.elements).toHaveLength(1);
    }
  });
});
