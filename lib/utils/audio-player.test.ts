import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioPlayer } from '@/lib/utils/audio-player';

class MockAudio {
  public src = '';
  public volume = 1;
  public defaultPlaybackRate = 1;
  public playbackRate = 1;
  public paused = true;
  public currentTime = 0;
  public duration = 1;
  private playReject: ((reason?: unknown) => void) | null = null;

  addEventListener() {}

  play() {
    this.paused = false;
    return new Promise<void>((_, reject) => {
      this.playReject = reject;
    });
  }

  pause() {
    this.paused = true;
    this.playReject?.(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
    this.playReject = null;
  }
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', MockAudio);
  });

  it('treats play interruption from pause as a non-fatal cancellation', async () => {
    const player = new AudioPlayer();
    const playPromise = player.play('tts_1', '/audio/test.wav');

    player.pause();

    await expect(playPromise).resolves.toBe(false);
  });
});
