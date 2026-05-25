import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/classroom-storage', () => ({
  buildRequestOrigin: vi.fn(() => 'http://localhost:3000'),
  isValidClassroomId: vi.fn(() => true),
  readClassroom: vi.fn(),
  persistClassroom: vi.fn(async ({ id, stage, scenes }, baseUrl: string) => ({
    id,
    stage,
    scenes,
    createdAt: '2026-05-20T00:00:00.000Z',
    url: `${baseUrl}/classroom/${id}`,
  })),
}));

vi.mock('@/lib/server/classroom-media-generation', () => ({
  generateTTSForClassroom: vi.fn(async (scenes, classroomId: string, baseUrl: string) => {
    const speechAction = scenes[0]?.actions?.find((action: { type: string }) => action.type === 'speech');
    if (speechAction) {
      speechAction.audioUrl = `${baseUrl}/api/classroom-media/${classroomId}/audio/demo.mp3`;
    }
  }),
}));

import { generateTTSForClassroom } from '@/lib/server/classroom-media-generation';
import { persistClassroom, readClassroom } from '@/lib/server/classroom-storage';
import { GET, POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/classroom', () => {
  it('persists server-playable audio urls for speech actions', async () => {
    const request = new Request('http://localhost/api/classroom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stage: {
          id: 'stage-1',
          name: '数学讲解',
          description: '',
          style: 'professional',
          createdAt: 1,
          updatedAt: 1,
          interactiveMode: false,
        },
        scenes: [
          {
            id: 'scene-1',
            stageId: 'stage-1',
            type: 'slide',
            title: '第一页',
            order: 1,
            content: {
              type: 'slide',
              canvas: {
                id: 'canvas-1',
                viewportSize: 1000,
                viewportRatio: 0.5625,
                elements: [],
                background: { type: 'solid', color: '#fff' },
              },
            },
            actions: [
              {
                id: 'speech-1',
                type: 'speech',
                text: '同学们好，先来看题目。',
                audioId: 'tts_s1_speech-1',
              },
            ],
          },
        ],
      }),
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(generateTTSForClassroom).toHaveBeenCalledWith(
      expect.any(Array),
      'stage-1',
      'http://localhost:3000',
    );
    expect(persistClassroom).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stage-1',
        scenes: [
          expect.objectContaining({
            actions: [
              expect.objectContaining({
                type: 'speech',
                audioId: 'tts_s1_speech-1',
                audioUrl: 'http://localhost:3000/api/classroom-media/stage-1/audio/demo.mp3',
              }),
            ],
          }),
        ],
      }),
      'http://localhost:3000',
    );
    expect(json).toEqual({
      success: true,
      id: 'stage-1',
      url: 'http://localhost:3000/classroom/stage-1',
    });
  });
});

describe('GET /api/classroom', () => {
  it('backfills audio urls for persisted speech actions that only have audioId', async () => {
    vi.mocked(readClassroom).mockResolvedValueOnce({
      id: 'stage-legacy',
      createdAt: '2026-05-20T00:00:00.000Z',
      stage: {
        id: 'stage-legacy',
        name: '旧课堂',
        description: '',
        style: 'professional',
        createdAt: 1,
        updatedAt: 1,
        interactiveMode: false,
      },
      scenes: [
        {
          id: 'scene-1',
          stageId: 'stage-legacy',
          type: 'slide',
          title: '第一页',
          order: 1,
          content: {
            type: 'slide',
            canvas: {
              id: 'canvas-1',
              viewportSize: 1000,
              viewportRatio: 0.5625,
              elements: [],
              background: { type: 'solid', color: '#fff' },
            },
          },
          actions: [
            {
              id: 'speech-1',
              type: 'speech',
              text: '这是一条旧的讲解音频。',
              audioId: 'tts_s1_speech-1',
            },
          ],
        },
      ],
    } as never);

    const request = {
      nextUrl: new URL('http://localhost/api/classroom?id=stage-legacy'),
      headers: new Headers(),
    };

    const response = await GET(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(generateTTSForClassroom).toHaveBeenCalledWith(
      expect.any(Array),
      'stage-legacy',
      'http://localhost:3000',
    );
    expect(persistClassroom).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stage-legacy',
        scenes: [
          expect.objectContaining({
            actions: [
              expect.objectContaining({
                type: 'speech',
                audioUrl: 'http://localhost:3000/api/classroom-media/stage-legacy/audio/demo.mp3',
              }),
            ],
          }),
        ],
      }),
      'http://localhost:3000',
    );
    expect(json.classroom.scenes[0].actions[0].audioUrl).toBe(
      'http://localhost:3000/api/classroom-media/stage-legacy/audio/demo.mp3',
    );
  });
});
