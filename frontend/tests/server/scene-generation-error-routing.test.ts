import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resolveModelFromRequest: vi.fn(),
  applyOutlineFallbacks: vi.fn((outline) => outline),
  generateSceneContent: vi.fn(),
  buildVisionUserContent: vi.fn(() => []),
  generateSceneActions: vi.fn(),
  buildCompleteScene: vi.fn(),
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: mocks.resolveModelFromRequest,
}));

vi.mock('@/lib/generation/generation-pipeline', () => ({
  applyOutlineFallbacks: mocks.applyOutlineFallbacks,
  generateSceneContent: mocks.generateSceneContent,
  buildVisionUserContent: mocks.buildVisionUserContent,
  generateSceneActions: mocks.generateSceneActions,
  buildCompleteScene: mocks.buildCompleteScene,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const RATE_LIMIT_ERROR =
  'AI_RetryError: Failed after 3 attempts. Last error: rate limit reached for RPM (request_id: chatcmpl-test)';

function mockResolvedModel() {
  mocks.resolveModelFromRequest.mockResolvedValue({
    model: 'mock-model',
    modelInfo: { capabilities: {} },
    modelString: 'kimi:gemini-2.5-flash',
    thinkingConfig: undefined,
  });
}

describe('scene generation routes surface upstream rate limits', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.resolveModelFromRequest.mockReset();
    mocks.applyOutlineFallbacks.mockClear();
    mocks.generateSceneContent.mockReset();
    mocks.generateSceneActions.mockReset();
    mocks.buildCompleteScene.mockReset();
    mockResolvedModel();
  });

  it('scene-content route returns the extracted RPM error message', async () => {
    mocks.generateSceneContent.mockRejectedValue(new Error(RATE_LIMIT_ERROR));

    const { POST } = await import('@/app/api/generate/scene-content/route');
    const request = new Request('http://localhost/api/generate/scene-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outline: {
          id: 'scene-1',
          type: 'slide',
          title: '第一页',
          description: 'desc',
          keyPoints: ['k1'],
          order: 1,
        },
        allOutlines: [
          {
            id: 'scene-1',
            type: 'slide',
            title: '第一页',
            description: 'desc',
            keyPoints: ['k1'],
            order: 1,
          },
        ],
        stageId: 'stage-1',
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('rate limit reached for RPM');
  });

  it('scene-actions route returns the extracted RPM error message', async () => {
    mocks.generateSceneActions.mockRejectedValue(new Error(RATE_LIMIT_ERROR));

    const { POST } = await import('@/app/api/generate/scene-actions/route');
    const request = new Request('http://localhost/api/generate/scene-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outline: {
          id: 'scene-1',
          type: 'slide',
          title: '第一页',
          description: 'desc',
          keyPoints: ['k1'],
          order: 1,
        },
        allOutlines: [
          {
            id: 'scene-1',
            type: 'slide',
            title: '第一页',
            description: 'desc',
            keyPoints: ['k1'],
            order: 1,
          },
        ],
        content: {
          background: { type: 'solid', color: '#fff' },
          elements: [],
        },
        stageId: 'stage-1',
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('rate limit reached for RPM');
  });
});
