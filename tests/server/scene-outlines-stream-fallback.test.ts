import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  streamLLM: vi.fn(),
  callLLM: vi.fn(),
  resolveModelFromRequest: vi.fn(),
}));

vi.mock('@/lib/ai/llm', () => ({
  streamLLM: mocks.streamLLM,
  callLLM: mocks.callLLM,
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: mocks.resolveModelFromRequest,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('POST /api/generate/scene-outlines-stream fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.streamLLM.mockReset();
    mocks.callLLM.mockReset();
    mocks.resolveModelFromRequest.mockReset();
    mocks.resolveModelFromRequest.mockResolvedValue({
      model: 'mock-model',
      modelInfo: { capabilities: {} },
      modelString: 'kimi:gemini-2.5-flash',
      thinkingConfig: undefined,
    });
  });

  it('falls back to non-stream outline generation when streaming returns empty output', async () => {
    mocks.streamLLM.mockReturnValue({
      textStream: (async function* () {
        yield '';
      })(),
    });

    mocks.callLLM.mockResolvedValue({
      text: JSON.stringify({
        languageDirective: 'Teach in Chinese.',
        outlines: [
          {
            id: 'scene-1',
            type: 'slide',
            title: '第一步',
            description: '先求宽',
            keyPoints: ['面积除以长'],
            order: 1,
          },
        ],
      }),
    });

    const { POST } = await import('@/app/api/generate/scene-outlines-stream/route');
    const request = new Request('http://localhost/api/generate/scene-outlines-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirements: {
          requirement: '讲解面积题',
          userNickname: '学生',
        },
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"done"');
    expect(body).toContain('"title":"第一步"');
    expect(mocks.callLLM).toHaveBeenCalledTimes(1);
  });
});
