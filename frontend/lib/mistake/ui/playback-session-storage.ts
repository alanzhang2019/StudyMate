const PLAYBACK_KEY = 'playbackSession';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PlaybackResumeState = {
  classroomId: string;
  sceneId: string;
  sceneIndex: number;
  isPlaying: boolean;
  savedAt: number;
};

function safeGet(): string | null {
  try {
    return sessionStorage.getItem(PLAYBACK_KEY);
  } catch {
    return null;
  }
}

function safeSet(value: string): void {
  try {
    sessionStorage.setItem(PLAYBACK_KEY, value);
  } catch {
    // storage disabled / quota full — degrade silently
  }
}

function safeRemove(): void {
  try {
    sessionStorage.removeItem(PLAYBACK_KEY);
  } catch {
    // ignore
  }
}

function isExpired(savedAt: number, now = Date.now()): boolean {
  return now - savedAt > MAX_AGE_MS;
}

export function savePlaybackSession(s: PlaybackResumeState): void {
  safeSet(JSON.stringify(s));
}

export function loadPlaybackSession(): PlaybackResumeState | null {
  const raw = safeGet();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlaybackResumeState;
    if (!parsed?.classroomId || typeof parsed.savedAt !== 'number') return null;
    if (isExpired(parsed.savedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlaybackSession(_classroomId?: string): void {
  // Single-slot design: only the latest playback is persisted.
  // Parameter is accepted for API symmetry with future multi-slot use; ignored.
  safeRemove();
}
