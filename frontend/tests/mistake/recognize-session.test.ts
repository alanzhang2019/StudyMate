import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, string> = {};
const sessionStorageStub = {
  getItem: (key: string) => (key in store ? store[key] : null),
  setItem: (key: string, value: string) => {
    store[key] = String(value);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};

vi.stubGlobal('sessionStorage', sessionStorageStub);
vi.stubGlobal('window', { sessionStorage: sessionStorageStub });

import {
  clearPendingRecognizeSession,
  readPendingRecognizeSession,
  writePendingRecognizeSession,
} from '@/lib/mistake/ui/recognize-session';

describe('recognize-session storage', () => {
  beforeEach(() => {
    sessionStorageStub.clear();
  });

  it('round-trips the OCR confirmation payload through sessionStorage', () => {
    const payload = {
      imageUrl: 'blob:test',
      problemText: '12 ÷ 3 = ?',
      studentAnswer: '5',
      correctAnswerCandidate: '4',
      confidence: 0.72,
      needsUserConfirmation: true,
    };

    writePendingRecognizeSession(payload);
    expect(readPendingRecognizeSession()).toEqual(payload);

    clearPendingRecognizeSession();
    expect(readPendingRecognizeSession()).toBeNull();
  });
});
