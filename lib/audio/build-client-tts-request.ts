type ClientTTSProviderConfig = {
  apiKey?: string;
  serverBaseUrl?: string;
  baseUrl?: string;
  customDefaultBaseUrl?: string;
};

export function buildClientTTSRequestConfig(
  ttsProviderId: string | undefined,
  ttsProviderConfig?: ClientTTSProviderConfig,
): {
  ttsApiKey: string | undefined;
  ttsBaseUrl: string | undefined;
} {
  if (ttsProviderId === 'voxcpm-tts') {
    return {
      ttsApiKey: undefined,
      ttsBaseUrl: undefined,
    };
  }

  return {
    ttsApiKey: ttsProviderConfig?.apiKey || undefined,
    ttsBaseUrl:
      ttsProviderConfig?.baseUrl || ttsProviderConfig?.customDefaultBaseUrl || undefined,
  };
}
