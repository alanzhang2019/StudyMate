import { beforeEach, describe, expect, it, vi } from 'vitest';

const audioPutMock = vi.fn();
const fetchMock = vi.fn();
const getVoxCPMProviderOptionsMock = vi.fn();

let settingsState = {
  ttsEnabled: true,
  ttsProviderId: 'voxcpm-tts',
  ttsVoice: 'teacher',
  ttsSpeed: 1,
  ttsProvidersConfig: {
    'voxcpm-tts': {
      apiKey: 'secret-key',
      baseUrl: 'http://127.0.0.1:8005/v1',
      serverBaseUrl: 'http://127.0.0.1:8005/v1',
      customDefaultBaseUrl: 'http://127.0.0.1:8005/v1',
      modelId: 'voxcpm-vllm',
      providerOptions: { backend: 'vllm' },
      enabled: true,
    },
  },
};

vi.mock('@/lib/store/settings', () => ({
  useSettingsStore: {
    getState: () => settingsState,
  },
}));

vi.mock('@/lib/utils/database', () => ({
  db: {
    audioFiles: {
      put: audioPutMock,
    },
  },
}));

vi.mock('@/lib/audio/voxcpm-voices', () => ({
  getVoxCPMProviderOptions: getVoxCPMProviderOptionsMock,
}));

vi.mock('@/lib/media/media-orchestrator', () => ({
  generateMediaForOutlines: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('generateAndStoreTTS request config', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    audioPutMock.mockReset();
    getVoxCPMProviderOptionsMock.mockReset();
    getVoxCPMProviderOptionsMock.mockResolvedValue({ emotion: 'patient' });
    settingsState = {
      ttsEnabled: true,
      ttsProviderId: 'voxcpm-tts',
      ttsVoice: 'teacher',
      ttsSpeed: 1,
      ttsProvidersConfig: {
        'voxcpm-tts': {
          apiKey: 'secret-key',
          baseUrl: 'http://127.0.0.1:8005/v1',
          serverBaseUrl: 'http://127.0.0.1:8005/v1',
          customDefaultBaseUrl: 'http://127.0.0.1:8005/v1',
          modelId: 'voxcpm-vllm',
          providerOptions: { backend: 'vllm' },
          enabled: true,
        },
      },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        success: true,
        base64: 'QQ==',
        format: 'wav',
      }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
  });

  it('omits client baseUrl and apiKey for voxcpm classroom TTS generation', async () => {
    const { generateAndStoreTTS } = await import('@/lib/hooks/use-scene-generator');

    await generateAndStoreTTS('audio-1', '第二页讲解', 'zh-CN');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.ttsProviderId).toBe('voxcpm-tts');
    expect(body.ttsApiKey).toBeUndefined();
    expect(body.ttsBaseUrl).toBeUndefined();
    expect(body.ttsProviderOptions).toEqual({
      backend: 'vllm',
      emotion: 'patient',
    });
  });
});
