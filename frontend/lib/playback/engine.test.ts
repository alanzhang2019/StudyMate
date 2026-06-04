import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaybackEngine } from './engine';
import { useSettingsStore } from '@/lib/store/settings';
import type { Scene } from '@/lib/types/stage';

class MockSpeechSynthesisUtterance {
  public rate = 1;
  public volume = 1;
  public lang = '';
  public voice: SpeechSynthesisVoice | null = null;
  public onend: (() => void) | null = null;
  public onerror: ((event: { error: string }) => void) | null = null;

  constructor(public readonly text: string) {}
}

function createScene(): Scene {
  return {
    id: 'scene-1',
    stageId: 'stage-1',
    type: 'slide',
    title: 'Scene 1',
    order: 1,
    content: {
      type: 'slide',
      canvas: {} as never,
    },
    actions: [
      {
        id: 'speech-1',
        type: 'speech',
        text: '老师开始讲解这道题。',
        audioId: 'tts_s1_speech-1',
      },
    ],
  };
}

describe('PlaybackEngine', () => {
  const originalSettings = useSettingsStore.getState();

  beforeEach(() => {
    useSettingsStore.setState({
      ...originalSettings,
      ttsEnabled: true,
      ttsProviderId: 'siliconflow-tts',
      ttsVoice: 'FunAudioLLM/CosyVoice2-0.5B:alex',
      ttsSpeed: 1,
      ttsMuted: false,
      ttsVolume: 1,
    });
  });

  afterEach(() => {
    useSettingsStore.setState(originalSettings);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses reading timer when generated audio is unavailable', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const speak = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      queueMicrotask(() => utterance.onend?.());
    });

    vi.stubGlobal('window', {
      speechSynthesis: {
        getVoices: vi.fn(() => [{ voiceURI: 'browser-voice', lang: 'zh-CN' }]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        cancel: vi.fn(),
        speak,
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);

    const audioPlayer = {
      onEnded: vi.fn(),
      play: vi.fn().mockResolvedValue(false),
      isPlaying: vi.fn().mockReturnValue(false),
      hasActiveAudio: vi.fn().mockReturnValue(false),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };

    const actionEngine = {
      execute: vi.fn(),
      clearEffects: vi.fn(),
    };

    const engine = new PlaybackEngine(
      [createScene()],
      actionEngine as never,
      audioPlayer as never,
      {},
    );

    engine.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(audioPlayer.play).toHaveBeenCalledWith('tts_s1_speech-1', undefined);
    expect(speak).toHaveBeenCalledTimes(0);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBeGreaterThanOrEqual(2000);
  });
});
