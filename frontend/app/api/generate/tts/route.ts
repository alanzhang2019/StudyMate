/**
 * Single TTS Generation API
 *
 * Generates TTS audio for a single text string and returns base64-encoded audio.
 * Called by the client in parallel for each speech action after a scene is generated.
 *
 * POST /api/generate/tts
 */

import { NextRequest } from 'next/server';
import { generateTTS } from '@/lib/audio/tts-providers';
import { resolveTTSApiKey, resolveTTSBaseUrl } from '@/lib/server/provider-config';
import type { TTSProviderId } from '@/lib/audio/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { VOXCPM_AUTO_VOICE_ID, VOXCPM_TTS_PROVIDER_ID } from '@/lib/audio/voxcpm';
import { getTeacherVoice } from '@/lib/server/teacher-voice';
import { db } from '@/lib/db';

const log = createLogger('TTS API');

let cachedTTSConfig: { value: unknown; fetchedAt: number } | null = null;
const TTS_CONFIG_CACHE_TTL_MS = 60_000;

async function getGlobalTTSConfig() {
  const now = Date.now();
  if (cachedTTSConfig && now - cachedTTSConfig.fetchedAt < TTS_CONFIG_CACHE_TTL_MS) {
    return cachedTTSConfig.value;
  }
  try {
    const configRecord = await db.systemConfig.findUnique({ where: { key: 'default_tts_config' } });
    const value = configRecord?.value
      ? (typeof configRecord.value === 'string' ? JSON.parse(configRecord.value) : configRecord.value)
      : null;
    cachedTTSConfig = { value, fetchedAt: now };
    return value;
  } catch (err) {
    log.warn('Failed to read global TTS config from DB:', err);
    return null;
  }
}

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let ttsProviderId: string | undefined;
  let ttsVoice: string | undefined;
  let audioId: string | undefined;
  try {
    const body = await req.json();
    let { text, ttsModelId, ttsSpeed, ttsApiKey, ttsBaseUrl, ttsProviderOptions, profileTtsVoice } = body as {
      text: string;
      audioId: string;
      ttsProviderId: TTSProviderId;
      ttsModelId?: string;
      ttsVoice: string;
      ttsSpeed?: number;
      ttsApiKey?: string;
      ttsBaseUrl?: string;
      ttsProviderOptions?: Record<string, unknown>;
      profileTtsVoice?: string;
    };
    ttsProviderId = body.ttsProviderId;
    ttsVoice = body.ttsVoice;
    audioId = body.audioId;

    // Apply global TTS config from DB if it exists
    const globalConfig = await getGlobalTTSConfig();
    if (globalConfig) {
      if ((globalConfig as Record<string, unknown>).provider) {
        ttsProviderId = (globalConfig as Record<string, unknown>).provider as string;
      }
      if ((globalConfig as Record<string, unknown>).voice) {
        ttsVoice = profileTtsVoice || (globalConfig as Record<string, unknown>).voice as string;
      }
    }

    // Hardcode teacher voice clone if VoxCPM is used.
    if (ttsProviderId === VOXCPM_TTS_PROVIDER_ID) {
      const teacherVoice = getTeacherVoice();
      if (teacherVoice.audio && teacherVoice.text) {
        ttsProviderOptions = {
          ...(ttsProviderOptions || {}),
          voiceMode: 'clone',
          referenceAudioBase64: teacherVoice.audio,
          referenceAudioMimeType: teacherVoice.mimeType,
          referenceAudioName: teacherVoice.fileName,
          promptText: teacherVoice.text,
        };
        ttsVoice = 'voxcpm:teacher-clone';
      }
    }

    // Validate required fields
    if (!text || !audioId || !ttsProviderId || !ttsVoice) {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'Missing required fields: text, audioId, ttsProviderId, ttsVoice',
      );
    }

    // Reject browser-native TTS — must be handled client-side
    if (ttsProviderId === 'browser-native-tts') {
      return apiError('INVALID_REQUEST', 400, 'browser-native-tts must be handled client-side');
    }

    // Ensure SiliconFlow TTS voice has the correct prefix
    if (ttsProviderId === 'siliconflow-tts' && ttsVoice) {
      const prefix = 'FunAudioLLM/CosyVoice2-0.5B:';
      if (!ttsVoice.startsWith(prefix)) {
        ttsVoice = `${prefix}${ttsVoice.toLowerCase()}`;
      }
      // Auto-migrate broken 'vivian' voice to 'alex' as SiliconFlow no longer supports it
      if (ttsVoice.includes('vivian')) {
        ttsVoice = 'FunAudioLLM/CosyVoice2-0.5B:alex';
      }
    }

    const voxcpmVoicePrompt =
      typeof ttsProviderOptions?.voicePrompt === 'string' ? ttsProviderOptions.voicePrompt : '';
    if (
      ttsProviderId === VOXCPM_TTS_PROVIDER_ID &&
      ttsVoice === VOXCPM_AUTO_VOICE_ID &&
      !voxcpmVoicePrompt.trim()
    ) {
      return apiError(
        'VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT',
        400,
        'VoxCPM Auto Voice requires agent context',
      );
    }

    const clientBaseUrl = ttsBaseUrl || undefined;
    if (clientBaseUrl) {
      const ssrfError = await validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const apiKey = clientBaseUrl
      ? ttsApiKey || ''
      : resolveTTSApiKey(ttsProviderId, ttsApiKey || undefined);
    const baseUrl = clientBaseUrl
      ? clientBaseUrl
      : resolveTTSBaseUrl(ttsProviderId, ttsBaseUrl || undefined);

    // Build TTS config
    const config = {
      providerId: ttsProviderId as TTSProviderId,
      modelId: ttsModelId,
      voice: ttsVoice,
      speed: ttsSpeed ?? 1.0,
      apiKey,
      baseUrl,
      providerOptions: ttsProviderOptions,
    };

    log.info(
      `Generating TTS: provider=${ttsProviderId}, model=${ttsModelId || 'default'}, voice=${ttsVoice}, audioId=${audioId}, textLen=${text.length}`,
    );

    // Generate audio
    const { audio, format } = await generateTTS(config, text);

    // Convert to base64
    const base64 = Buffer.from(audio).toString('base64');

    return apiSuccess({ audioId, base64, format });
  } catch (error) {
    log.error(
      `TTS generation failed [provider=${ttsProviderId ?? 'unknown'}, voice=${ttsVoice ?? 'unknown'}, audioId=${audioId ?? 'unknown'}]:`,
      error,
    );
    return apiError(
      'GENERATION_FAILED',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}
