import { describe, expect, it, vi } from 'vitest';

import { buildGenerationApiHeaders } from '@/app/generation-preview/api-headers';
import type { GenerationSessionState } from '@/app/generation-preview/types';

describe('buildGenerationApiHeaders', () => {
  it('syncs server providers before reading the model for mistake sessions', async () => {
    let currentModel = 'kimi:moonshotai/kimi-k2.6';
    const syncServerProviders = vi.fn(async () => {
      currentModel = 'kimi:gemini-2.5-flash';
    });

    const headers = await buildGenerationApiHeaders(
      { sourceMode: 'mistake' } as GenerationSessionState,
      {
        syncServerProviders,
        getCurrentModelConfig: () => ({
          providerId: 'kimi',
          modelId: currentModel.split(':')[1] || '',
          modelString: currentModel,
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

    expect(syncServerProviders).toHaveBeenCalledTimes(1);
    expect(headers['x-model']).toBe('kimi:gemini-2.5-flash');
  });

  it('does not sync server providers for non-mistake sessions', async () => {
    const syncServerProviders = vi.fn(async () => undefined);

    const headers = await buildGenerationApiHeaders(
      { sourceMode: 'default' } as GenerationSessionState,
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
