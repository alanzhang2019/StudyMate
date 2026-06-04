import { describe, expect, it } from 'vitest';

import { buildClientTTSRequestConfig } from './build-client-tts-request';

describe('buildClientTTSRequestConfig', () => {
  it('omits client baseUrl and apiKey for server-managed VoxCPM', () => {
    expect(
      buildClientTTSRequestConfig('voxcpm-tts', {
        apiKey: 'secret',
        serverBaseUrl: 'http://127.0.0.1:8005/v1',
        baseUrl: 'http://127.0.0.1:8005/v1',
        customDefaultBaseUrl: 'http://127.0.0.1:8005/v1',
      }),
    ).toEqual({
      ttsApiKey: undefined,
      ttsBaseUrl: undefined,
    });
  });

  it('does not treat serverBaseUrl as a client override for non-VoxCPM providers', () => {
    expect(
      buildClientTTSRequestConfig('openai-tts', {
        apiKey: '',
        serverBaseUrl: 'https://server.example.com/tts',
      }),
    ).toEqual({
      ttsApiKey: undefined,
      ttsBaseUrl: undefined,
    });
  });

  it('preserves explicit client overrides for non-server-managed providers', () => {
    expect(
      buildClientTTSRequestConfig('minimax-tts', {
        apiKey: 'secret',
        serverBaseUrl: 'https://server.example.com/tts',
        baseUrl: 'https://api.example.com/tts',
        customDefaultBaseUrl: 'https://fallback.example.com/tts',
      }),
    ).toEqual({
      ttsApiKey: 'secret',
      ttsBaseUrl: 'https://api.example.com/tts',
    });
  });
});
