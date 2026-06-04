import { describe, expect, test, vi } from 'vitest';
import {
  replaceMediaPlaceholders,
  resolveServerTTSRequestConfig,
} from '@/lib/server/classroom-media-generation';
import { VOXCPM_AUTO_VOICE_ID, VOXCPM_TTS_PROVIDER_ID } from '@/lib/audio/voxcpm';
import type { Scene } from '@/lib/types/stage';

vi.mock('@/lib/server/teacher-voice', () => ({
  getTeacherVoice: () => ({ audio: '', text: '', mimeType: 'audio/wav', fileName: 'teacher.wav' })
}));

function slideScene(
  elements: Array<{ id: string; type: string; src?: string; mediaRef?: string }>,
) {
  return {
    id: 'scene_1',
    stageId: 'stage_1',
    type: 'slide',
    title: 'Scene',
    order: 1,
    content: {
      type: 'slide',
      canvas: {
        id: 'canvas_1',
        elements,
      },
    },
  } as unknown as Scene;
}

describe('classroom media placeholder replacement', () => {
  test('preserves direct video src when mediaRef is also present', () => {
    const scene = slideScene([
      {
        id: 'video_1',
        type: 'video',
        src: 'https://example.com/direct.mp4',
        mediaRef: 'gen_vid_real123',
      },
    ]);

    replaceMediaPlaceholders([scene], {
      gen_vid_real123: 'https://cdn.example.com/generated.mp4',
    });

    const content = scene.content as {
      canvas: { elements: Array<{ src?: string }> };
    };
    const video = content.canvas.elements[0];
    expect(video.src).toBe('https://example.com/direct.mp4');
  });
});

describe('resolveServerTTSRequestConfig', () => {
  test('downgrades VoxCPM auto voice to a prompt-based server request', () => {
    const resolved = resolveServerTTSRequestConfig(VOXCPM_TTS_PROVIDER_ID, VOXCPM_AUTO_VOICE_ID);

    expect(resolved).toEqual({
      voice: VOXCPM_AUTO_VOICE_ID,
      providerOptions: {
        voicePrompt: 'natural classroom voice',
      },
    });
  });
});
