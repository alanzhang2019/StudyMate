import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getModelMock = vi.fn();

vi.mock('@/lib/ai/providers', () => ({
  parseModelString: (modelString: string) => {
    const [providerId, modelId = ''] = modelString.split(':');
    return { providerId, modelId };
  },
  getModel: getModelMock,
}));

vi.mock('@/lib/server/provider-config', () => ({
  resolveApiKey: vi.fn((providerId: string) => `server-key-for-${providerId}`),
  resolveBaseUrl: vi.fn(() => 'https://example.com/v1'),
  resolveProxy: vi.fn(() => undefined),
  getServerProviders: vi.fn(() => ({
    kimi: { models: ['moonshotai/kimi-k2.6'] },
  })),
}));

describe('resolveModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModelMock.mockReturnValue({
      model: { mocked: true },
      modelInfo: { capabilities: { vision: true } },
    });
  });

  afterEach(() => {
    delete process.env.DEFAULT_MODEL;
  });

  it('recovers the first server model when request model string omits model id', async () => {
    const { resolveModel } = await import('@/lib/server/resolve-model');

    const resolved = await resolveModel({
      modelString: 'kimi:',
    });

    expect(getModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'kimi',
        modelId: 'moonshotai/kimi-k2.6',
        apiKey: 'server-key-for-kimi',
      }),
    );
    expect(resolved.modelString).toBe('kimi:moonshotai/kimi-k2.6');
    expect(resolved.modelId).toBe('moonshotai/kimi-k2.6');
  });
});
