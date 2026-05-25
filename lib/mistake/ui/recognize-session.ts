import type { MistakeImageExtraction } from '@/lib/mistake/ocr/types';

const STORAGE_KEY = 'pendingRecognizeSession';

export type PendingRecognizeSession = MistakeImageExtraction & {
  imageUrl: string;
};

export function writePendingRecognizeSession(payload: PendingRecognizeSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingRecognizeSession(): PendingRecognizeSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingRecognizeSession) : null;
}

export function clearPendingRecognizeSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}
