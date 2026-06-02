import { describe, expect, it, vi } from 'vitest';

import { buildGenerationApiHeaders } from '@/app/generation-preview/api-headers';
import type { GenerationSessionState } from '@/app/generation-preview/types';

describe('buildGenerationApiHeaders', () => {
  it('keeps mistake sessions on the current selected model instead of overriding to a server-only mistake model', async () => {
    const syncServerProviders = vi.fn(async () => undefined);

    const headers = await buildGenerationApiHeaders(
      { mistakeSessionId: 'mistake-1' } as GenerationSessionState,
      {
        syncServerProviders,
        getCurrentModelConfig: () => ({
          providerId: 'kimi',
          modelId: 'moonshotai/kimi-k2.6',
          modelString: 'kimi:moonshotai/kimi-k2.6',
          apiKey: '',
          baseUrl: '',
          providerType: 'openai',
          requiresApiKey: true,
          isServerConfigured: true,
          thinkingConfig: undefined,
        }),
        getSettings: () => ({
          imageProviderId: 'seedream',
          imageModelId: 'doubao-seedream-5-0-260128',
          videoProviderId: 'seedance',
          videoModelId: 'doubao-seedance-1-5-pro-251215',
          imageGenerationEnabled: false,
          videoGenerationEnabled: false,
          imageProvidersConfig: {},
          videoProvidersConfig: {},
        }),
      },
    );

    expect(syncServerProviders).not.toHaveBeenCalled();
    expect(headers['x-model']).toBe('kimi:moonshotai/kimi-k2.6');
  });

  it('does not sync server providers for non-mistake sessions', async () => {
    const syncServerProviders = vi.fn(async () => undefined);

    const headers = await buildGenerationApiHeaders(
      { sessionId: 'preview-1' } as GenerationSessionState,
      {
        syncServerProviders,
        getCurrentModelConfig: () => ({
          providerId: 'kimi',
          modelId: 'gemini-2.5-flash',
          modelString: 'kimi:gemini-2.5-flash',
          apiKey: '',
          baseUrl: '',
          providerType: 'openai',
          requiresApiKey: true,
          isServerConfigured: true,
          thinkingConfig: undefined,
        }),
        getSettings: () => ({
          imageProviderId: 'seedream',
          imageModelId: 'doubao-seedream-5-0-260128',
          videoProviderId: 'seedance',
          videoModelId: 'doubao-seedance-1-5-pro-251215',
          imageGenerationEnabled: false,
          videoGenerationEnabled: false,
          imageProvidersConfig: {},
          videoProvidersConfig: {},
        }),
      },
    );

    expect(syncServerProviders).not.toHaveBeenCalled();
    expect(headers['x-model']).toBe('kimi:gemini-2.5-flash');
  });
});
