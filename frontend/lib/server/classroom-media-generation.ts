/**
 * Server-side media and TTS generation for classrooms.
 *
 * Generates image/video files and TTS audio for a classroom,
 * writes them to disk, and returns serving URL mappings.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import { generateImage } from '@/lib/media/image-providers';
import { generateVideo, normalizeVideoOptions } from '@/lib/media/video-providers';
import { generateTTS } from '@/lib/audio/tts-providers';
import { DEFAULT_TTS_VOICES, DEFAULT_TTS_MODELS, TTS_PROVIDERS } from '@/lib/audio/constants';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import { isMediaPlaceholder } from '@/lib/store/media-generation';
import {
  getServerImageProviders,
  getServerVideoProviders,
  getServerTTSProviders,
  resolveImageApiKey,
  resolveImageBaseUrl,
  resolveVideoApiKey,
  resolveVideoBaseUrl,
  resolveTTSApiKey,
  resolveTTSBaseUrl,
} from '@/lib/server/provider-config';
import type { SceneOutline, PdfImage, ImageMapping } from '@/lib/types/generation';
import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';
import type { ImageProviderId } from '@/lib/media/types';
import type { VideoProviderId } from '@/lib/media/types';
import type { TTSProviderId } from '@/lib/audio/types';
import { splitLongSpeechActions } from '@/lib/audio/tts-utils';
import {
  buildAutoVoxCPMVoicePrompt,
  VOXCPM_AUTO_VOICE_ID,
  VOXCPM_TTS_PROVIDER_ID,
} from '@/lib/audio/voxcpm';
import { getTeacherVoice } from '@/lib/server/teacher-voice';
import { db } from '@/lib/db';

const log = createLogger('ClassroomMedia');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const DOWNLOAD_TIMEOUT_MS = 120_000; // 2 minutes
const DOWNLOAD_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

async function downloadToBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const contentLength = Number(resp.headers.get('content-length') || 0);
  if (contentLength > DOWNLOAD_MAX_SIZE) {
    throw new Error(`File too large: ${contentLength} bytes (max ${DOWNLOAD_MAX_SIZE})`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

function mediaServingUrl(baseUrl: string, classroomId: string, subPath: string): string {
  return `${baseUrl}/api/classroom-media/${classroomId}/${subPath}`;
}

// ---------------------------------------------------------------------------
// Caller-supplied (uploaded) images
// ---------------------------------------------------------------------------

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

/**
 * Best-effort intrinsic size reader for the formats a browser file picker
 * hands us. We only need width/height so the slide generator can size the
 * element box to the photo's real aspect ratio — `fixElementDefaults()` in
 * scene-generator.ts corrects the box from `PdfImage.width/height`, and the
 * LLM is told the ratio through `formatImageDescription()`.
 *
 * Deliberately dependency-free: the alternative (sharp) is a native module
 * and would add a cold-start cost to a code path that otherwise never
 * touches image codecs. A wrong/absent result is harmless — the renderer
 * falls back to `object-fit: contain`.
 *
 * Exported for unit tests: the header bit-twiddling is the one part of this
 * module that can silently regress without any integration test noticing.
 */
export function readImageDimensions(buf: Buffer): { width: number; height: number } | undefined {
  try {
    // PNG: 8-byte signature, then IHDR with width/height as BE uint32.
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    // GIF: "GIF87a"/"GIF89a", then LE uint16 width/height.
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }

    // WebP: RIFF container, dimensions live in the first sub-chunk.
    if (
      buf.length > 30 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const format = buf.toString('ascii', 12, 16);
      if (format === 'VP8X') {
        // Extended: 24-bit canvas size, stored as value-1.
        return {
          width: (buf.readUIntLE(24, 3) & 0xffffff) + 1,
          height: (buf.readUIntLE(27, 3) & 0xffffff) + 1,
        };
      }
      if (format === 'VP8 ') {
        // Lossy: 14-bit width/height inside the keyframe header.
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (format === 'VP8L') {
        // Lossless: 14-bit each, bit-packed after the 0x2f signature byte.
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }

    // JPEG: walk the marker chain to the first SOFn segment, which carries
    // height/width as BE uint16. Phone photos land here.
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buf[offset + 1];
        // Standalone markers carry no length field.
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const segmentLength = buf.readUInt16BE(offset + 2);
        const isStartOfFrame =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 && // DHT
          marker !== 0xc8 && // JPG
          marker !== 0xcc; // DAC
        if (isStartOfFrame) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 2 + segmentLength;
      }
    }
  } catch {
    // Malformed or truncated upload — fall through to "size unknown".
  }
  return undefined;
}

/** Provenance string shown to the LLM for a caller-supplied image. */
const UPLOADED_IMAGE_ORIGIN = "the student's uploaded photo of the original problem";

/**
 * Persist caller-supplied images (the mistake lesson's uploaded problem photo)
 * into the classroom's `media/` directory.
 *
 * Returns three views of the same images, because they are consumed in three
 * different places that cannot share one shape:
 *
 *  - `pdfImages` — descriptors whose `src` is a public serving URL. Feed to
 *    scene generation as `assignedImages`, so the slide prompt can offer the
 *    photo to the model by id.
 *  - `imageMapping` — `id → serving URL`. Feed to scene generation as
 *    `imageMapping`, so `resolveImageIds()` can swap `src: "img_1"` for a real
 *    URL. Without this the element is *dropped*, not blanked.
 *  - `visionImages` — same ids but `src` is an inline data URL. Feed to the
 *    outline stage's vision call: the model provider must be able to read the
 *    bytes, and it cannot reach our server's own media route.
 *
 * Files on disk rather than inline data URLs because the classroom JSON is
 * re-read by the player on every open — a base64 blob would bloat it and be
 * re-parsed on every load.
 */
export async function persistInlineClassroomImages(
  images: { mimeType: string; base64: string }[],
  classroomId: string,
  baseUrl: string,
): Promise<{
  pdfImages: PdfImage[];
  imageMapping: ImageMapping;
  visionImages: Array<{ id: string; src: string; width?: number; height?: number; origin: string }>;
}> {
  const pdfImages: PdfImage[] = [];
  const imageMapping: ImageMapping = {};
  const visionImages: Array<{
    id: string;
    src: string;
    width?: number;
    height?: number;
    origin: string;
  }> = [];

  if (images.length === 0) return { pdfImages, imageMapping, visionImages };

  const mediaDir = path.join(CLASSROOMS_DIR, classroomId, 'media');
  await ensureDir(mediaDir);

  for (let idx = 0; idx < images.length; idx += 1) {
    const img = images[idx];
    const buffer = Buffer.from(img.base64, 'base64');
    if (buffer.length === 0) {
      log.warn(`Uploaded image #${idx} decoded to 0 bytes, skipping`);
      continue;
    }

    const mimeType = img.mimeType.toLowerCase();
    const ext = IMAGE_EXT_BY_MIME[mimeType] || 'png';
    // `img_N`, not `vision-N`: the slide prompt's examples are all `img_N`
    // and `isImageIdReference()` only recognises that shape as a resolvable
    // id reference — anything else is treated as a literal URL.
    const id = `img_${idx + 1}`;
    const filename = `${id}.${ext}`;

    try {
      await fs.writeFile(path.join(mediaDir, filename), buffer);
    } catch (err) {
      log.warn(`Failed to persist uploaded image ${id}:`, err);
      continue;
    }

    const url = mediaServingUrl(baseUrl, classroomId, `media/${filename}`);
    const size = readImageDimensions(buffer);

    pdfImages.push({
      id,
      src: url,
      pageNumber: 0,
      origin: UPLOADED_IMAGE_ORIGIN,
      ...(size ? { width: size.width, height: size.height } : {}),
    });
    imageMapping[id] = url;
    visionImages.push({
      id,
      src: `data:${img.mimeType};base64,${img.base64}`,
      origin: UPLOADED_IMAGE_ORIGIN,
      ...(size ? { width: size.width, height: size.height } : {}),
    });
  }

  log.info(
    `Persisted ${pdfImages.length}/${images.length} uploaded image(s) for classroom ${classroomId}`,
  );
  return { pdfImages, imageMapping, visionImages };
}

export function resolveServerTTSRequestConfig(providerId: string, voice: string) {
  if (providerId === VOXCPM_TTS_PROVIDER_ID) {
    // Check if we have a teacher voice to clone
    const teacherVoice = getTeacherVoice();
    if (teacherVoice.audio && teacherVoice.text) {
      return {
        voice: 'voxcpm:teacher-clone',
        providerOptions: {
          voiceMode: 'clone',
          referenceAudioBase64: teacherVoice.audio,
          referenceAudioMimeType: teacherVoice.mimeType,
          referenceAudioName: teacherVoice.fileName,
          promptText: teacherVoice.text,
        },
      };
    }
    
    if (voice === VOXCPM_AUTO_VOICE_ID) {
      return {
        voice,
        providerOptions: {
          voicePrompt: buildAutoVoxCPMVoicePrompt(),
        },
      };
    }
  }

  return {
    voice,
    providerOptions: undefined,
  };
}

// ---------------------------------------------------------------------------
// Image / Video generation
// ---------------------------------------------------------------------------

export async function generateMediaForClassroom(
  outlines: SceneOutline[],
  classroomId: string,
  baseUrl: string,
): Promise<Record<string, string>> {
  const mediaDir = path.join(CLASSROOMS_DIR, classroomId, 'media');
  await ensureDir(mediaDir);

  // Collect all media generation requests from outlines
  const requests = outlines.flatMap((o) => o.mediaGenerations ?? []);
  if (requests.length === 0) return {};

  // Resolve providers
  const imageProviderIds = Object.keys(getServerImageProviders());
  const videoProviderIds = Object.keys(getServerVideoProviders());

  const mediaMap: Record<string, string> = {};

  // Separate image and video requests, generate each type sequentially
  // but run the two types in parallel (providers often have limited concurrency).
  const imageRequests = requests.filter((r) => r.type === 'image' && imageProviderIds.length > 0);
  const videoRequests = requests.filter((r) => r.type === 'video' && videoProviderIds.length > 0);

  const generateImages = async () => {
    for (const req of imageRequests) {
      try {
        const providerId = imageProviderIds[0] as ImageProviderId;
        const apiKey = resolveImageApiKey(providerId);
        const providerConfig = IMAGE_PROVIDERS[providerId];
        if (providerConfig?.requiresApiKey && !apiKey) {
          log.warn(`No API key for image provider "${providerId}", skipping ${req.elementId}`);
          continue;
        }
        const model = providerConfig?.models?.[0]?.id;

        const result = await generateImage(
          { providerId, apiKey, baseUrl: resolveImageBaseUrl(providerId), model },
          { prompt: req.prompt, aspectRatio: req.aspectRatio || '16:9' },
        );

        let buf: Buffer;
        let ext: string;
        if (result.base64) {
          buf = Buffer.from(result.base64, 'base64');
          ext = 'png';
        } else if (result.url) {
          buf = await downloadToBuffer(result.url);
          const urlExt = path.extname(new URL(result.url).pathname).replace('.', '');
          ext = ['png', 'jpg', 'jpeg', 'webp'].includes(urlExt) ? urlExt : 'png';
        } else {
          log.warn(`Image generation returned no data for ${req.elementId}`);
          continue;
        }

        const filename = `${req.elementId}.${ext}`;
        await fs.writeFile(path.join(mediaDir, filename), buf);
        mediaMap[req.elementId] = mediaServingUrl(baseUrl, classroomId, `media/${filename}`);
        log.info(`Generated image: ${filename}`);
      } catch (err) {
        log.warn(`Image generation failed for ${req.elementId}:`, err);
      }
    }
  };

  const generateVideos = async () => {
    for (const req of videoRequests) {
      try {
        const providerId = videoProviderIds[0] as VideoProviderId;
        const apiKey = resolveVideoApiKey(providerId);
        if (!apiKey) {
          log.warn(`No API key for video provider "${providerId}", skipping ${req.elementId}`);
          continue;
        }
        const providerConfig = VIDEO_PROVIDERS[providerId];
        const model = providerConfig?.models?.[0]?.id;

        const normalized = normalizeVideoOptions(providerId, {
          prompt: req.prompt,
          aspectRatio: (req.aspectRatio as '16:9' | '4:3' | '1:1' | '9:16') || '16:9',
        });

        const result = await generateVideo(
          { providerId, apiKey, baseUrl: resolveVideoBaseUrl(providerId), model },
          normalized,
        );

        const buf = await downloadToBuffer(result.url);
        const filename = `${req.elementId}.mp4`;
        await fs.writeFile(path.join(mediaDir, filename), buf);
        mediaMap[req.elementId] = mediaServingUrl(baseUrl, classroomId, `media/${filename}`);
        log.info(`Generated video: ${filename}`);
      } catch (err) {
        log.warn(`Video generation failed for ${req.elementId}:`, err);
      }
    }
  };

  await Promise.all([generateImages(), generateVideos()]);

  return mediaMap;
}

// ---------------------------------------------------------------------------
// Placeholder replacement in scene content
// ---------------------------------------------------------------------------

export function replaceMediaPlaceholders(scenes: Scene[], mediaMap: Record<string, string>): void {
  if (Object.keys(mediaMap).length === 0) return;

  for (const scene of scenes) {
    if (scene.type !== 'slide') continue;
    const canvas = (
      scene.content as {
        canvas?: {
          elements?: Array<{ id: string; src?: string; mediaRef?: string; type?: string }>;
        };
      }
    )?.canvas;
    if (!canvas?.elements) continue;

    for (const el of canvas.elements) {
      if (
        el.type === 'video' &&
        typeof el.mediaRef === 'string' &&
        mediaMap[el.mediaRef] &&
        (!el.src || isMediaPlaceholder(el.src))
      ) {
        el.src = mediaMap[el.mediaRef];
        continue;
      }
      if (
        (el.type === 'image' || el.type === 'video') &&
        typeof el.src === 'string' &&
        isMediaPlaceholder(el.src) &&
        mediaMap[el.src]
      ) {
        el.src = mediaMap[el.src];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TTS generation
// ---------------------------------------------------------------------------

export async function generateTTSForClassroom(
  scenes: Scene[],
  classroomId: string,
  baseUrl: string,
): Promise<void> {
  const audioDir = path.join(CLASSROOMS_DIR, classroomId, 'audio');
  await ensureDir(audioDir);

  let globalConfig: { provider: TTSProviderId; voice: string } | null = null;
  try {
    const configRecord = await db.systemConfig.findUnique({ where: { key: 'default_tts_config' } });
    if (configRecord?.value) {
      globalConfig = typeof configRecord.value === 'string' ? JSON.parse(configRecord.value) : configRecord.value;
    }
  } catch (err) {
    log.warn('Failed to read global TTS config from DB:', err);
  }

  // Attempt to read profile TTS voice override
  let profileTtsVoice: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (db as any).mistakeSession?.findFirst({
      where: { classroomId },
      include: { profile: true },
    });
    if (session?.profile?.ttsVoice) {
      profileTtsVoice = session.profile.ttsVoice;
    }
  } catch (err) {
    log.warn('Failed to read profile TTS voice:', err);
  }
  // Resolve TTS provider (exclude browser-native-tts)
  const ttsProviderIds = Object.keys(getServerTTSProviders()).filter(
    (id) => id !== 'browser-native-tts',
  );
  if (ttsProviderIds.length === 0 && !globalConfig?.provider) {
    log.warn('No server TTS provider configured, skipping TTS generation');
    return;
  }

  const providerId = (globalConfig?.provider || ttsProviderIds[0]) as TTSProviderId;
  const apiKey = resolveTTSApiKey(providerId);
  const ttsProvider = TTS_PROVIDERS[providerId as keyof typeof TTS_PROVIDERS];
  if (ttsProvider?.requiresApiKey && !apiKey) {
    log.warn(`No API key for TTS provider "${providerId}", skipping TTS generation`);
    return;
  }
  const ttsBaseUrl = resolveTTSBaseUrl(providerId) || ttsProvider?.defaultBaseUrl;
  const defaultVoice = profileTtsVoice || globalConfig?.voice || DEFAULT_TTS_VOICES[providerId as keyof typeof DEFAULT_TTS_VOICES] || 'default';
  const resolvedVoiceConfig = resolveServerTTSRequestConfig(providerId, defaultVoice);
  const voice = resolvedVoiceConfig.voice;
  const format = ttsProvider?.supportedFormats?.[0] || 'mp3';

  for (const scene of scenes) {
    if (!scene.actions) continue;

    // Split long speech actions into multiple shorter ones before TTS generation,
    // mirroring the client-side approach. Each sub-action gets its own audio file.
    scene.actions = splitLongSpeechActions(scene.actions, providerId);

    // Use scene order to make audio IDs unique across scenes
    const sceneOrder = scene.order;

    for (const action of scene.actions) {
      if (action.type !== 'speech' || !(action as SpeechAction).text) continue;
      const speechAction = action as SpeechAction;
      // Include scene order in audioId to prevent collision across scenes
      const audioId = `tts_s${sceneOrder}_${action.id}`;

      try {
        const result = await generateTTS(
          {
            providerId,
            modelId: DEFAULT_TTS_MODELS[providerId as keyof typeof DEFAULT_TTS_MODELS] || '',
            apiKey,
            baseUrl: ttsBaseUrl,
            voice,
            speed: speechAction.speed,
            ...(resolvedVoiceConfig.providerOptions
              ? { providerOptions: resolvedVoiceConfig.providerOptions }
              : {}),
          },
          speechAction.text,
        );

        const filename = `${audioId}.${result.format || format}`;
        await fs.writeFile(path.join(audioDir, filename), result.audio);

        speechAction.audioId = audioId;
        speechAction.audioUrl = mediaServingUrl(baseUrl, classroomId, `audio/${filename}`);
        log.info(`Generated TTS: ${filename} (${result.audio.length} bytes)`);
      } catch (err) {
        log.warn(`TTS generation failed for action ${action.id}:`, err);
      }
    }
  }
}
