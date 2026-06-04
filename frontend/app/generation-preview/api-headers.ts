import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { useSettingsStore } from '@/lib/store/settings';

import type { GenerationSessionState } from './types';

type GenerationApiHeaders = Record<string, string>;

type GenerationApiHeaderDeps = {
  syncServerProviders: () => Promise<void>;
  getCurrentModelConfig: typeof getCurrentModelConfig;
  getSettings: () => {
    imageProviderId?: string;
    imageModelId?: string;
    videoProviderId?: string;
    videoModelId?: string;
    imageGenerationEnabled?: boolean;
    videoGenerationEnabled?: boolean;
    imageProvidersConfig?: Record<string, { apiKey?: string; baseUrl?: string } | undefined>;
    videoProvidersConfig?: Record<string, { apiKey?: string; baseUrl?: string } | undefined>;
  };
};

const defaultDeps: GenerationApiHeaderDeps = {
  syncServerProviders: () => useSettingsStore.getState().fetchServerProviders(),
  getCurrentModelConfig,
  getSettings: () => useSettingsStore.getState(),
};

export async function buildGenerationApiHeaders(
  _session: GenerationSessionState | null | undefined,
  deps: GenerationApiHeaderDeps = defaultDeps,
): Promise<GenerationApiHeaders> {
  const modelConfig = deps.getCurrentModelConfig();
  const settings = deps.getSettings();

  const imageProviderConfig = settings.imageProvidersConfig?.[settings.imageProviderId || ''];
  const videoProviderConfig = settings.videoProvidersConfig?.[settings.videoProviderId || ''];

  return {
    'Content-Type': 'application/json',
    'x-model': modelConfig.modelString,
    'x-api-key': modelConfig.apiKey,
    'x-base-url': modelConfig.baseUrl,
    'x-provider-type': modelConfig.providerType || '',
    'x-image-provider': settings.imageProviderId || '',
    'x-image-model': settings.imageModelId || '',
    'x-image-api-key': imageProviderConfig?.apiKey || '',
    'x-image-base-url': imageProviderConfig?.baseUrl || '',
    'x-video-provider': settings.videoProviderId || '',
    'x-video-model': settings.videoModelId || '',
    'x-video-api-key': videoProviderConfig?.apiKey || '',
    'x-video-base-url': videoProviderConfig?.baseUrl || '',
    'x-image-generation-enabled': String(settings.imageGenerationEnabled ?? false),
    'x-video-generation-enabled': String(settings.videoGenerationEnabled ?? false),
  };
}
