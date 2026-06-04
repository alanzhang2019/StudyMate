import { describe, expect, it } from 'vitest';

import { buildMistakeExtractHeaders } from '@/app/mistake/extract-api-headers';

describe('buildMistakeExtractHeaders', () => {
  it('uses server-side OCR configuration instead of forwarding current UI model headers', () => {
    const headers = buildMistakeExtractHeaders({
      providerId: 'kimi',
      modelId: 'moonshotai/kimi-k2.6',
      modelString: 'kimi:moonshotai/kimi-k2.6',
      apiKey: 'client-side-key',
      baseUrl: 'https://custom-proxy.example.com/v1',
      providerType: 'openai',
      requiresApiKey: true,
      isServerConfigured: false,
      thinkingConfig: undefined,
    });

    expect(headers).toEqual({});
  });
});
