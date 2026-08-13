import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Minimal browser-like localStorage stub. The production code
// (`persistence.ts`) uses `window.localStorage` via `safeGet`/`safeSet`,
// and the default vitest environment is node, so we stub both
// `localStorage` and `window.localStorage` to a shared in-memory
// map. Mirrors the convention used by `tests/quiz/persistence.test.ts`.
const store: Record<string, string> = {};
const localStorageStub = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};
vi.stubGlobal('localStorage', localStorageStub);
vi.stubGlobal('window', { localStorage: localStorageStub });

import { gradeSceneFully } from '@/components/scene-renderers/quiz-view';

// Mock the entire @/lib/utils/model-config so gradeSceneFully
// can build the fetch headers without crashing under vitest.
vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: () => ({
    modelString: 'mock',
    apiKey: 'mock',
    baseUrl: '',
    providerType: '',
  }),
}));

const makeChoiceQ = (id: string, answer: string, points = 1) =>
  ({
    id,
    type: 'choice' as const,
    question: `q-${id}`,
    options: ['A', 'B'],
    answer,
    points,
  }) as any;

const makeShortQ = (id: string, points = 2) =>
  ({
    id,
    type: 'short_answer' as const,
    question: `q-${id}`,
    answer: ['ref'],
    points,
    commentPrompt: 'p',
  }) as any;

describe('gradeSceneFully', () => {
  beforeEach(() => {
    // Make localStorage deterministic; gradeSceneFully reads
    // quizResults:<sceneId> as a "reviewing cache" fast path.
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grades only-choice questions locally', async () => {
    const qs = [makeChoiceQ('q1', 'A'), makeChoiceQ('q2', 'B')];
    const answers = { q1: 'A', q2: 'C' };
    const out = await gradeSceneFully('s1', qs, answers, 'zh-CN');
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.questionId === 'q1')?.status).toBe('correct');
    expect(out.find((r) => r.questionId === 'q2')?.status).toBe('incorrect');
  });

  it('reuses persisted results when scene already reviewing', async () => {
    window.localStorage.setItem(
      'quizResults:s2',
      JSON.stringify([
        { questionId: 'q1', correct: true, status: 'correct', earned: 1 },
      ]),
    );
    const fetchSpy = vi.spyOn(global, 'fetch');
    const out = await gradeSceneFully('s2', [makeChoiceQ('q1', 'A')], { q1: 'A' }, 'zh-CN');
    expect(out).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls /api/quiz-grade for short_answer questions', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ score: 2, comment: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const out = await gradeSceneFully('s3', [makeShortQ('q1', 2)], { q1: 'answer' }, 'zh-CN');
    expect(out[0].earned).toBe(2);
    expect(out[0].status).toBe('correct');
    expect(fetchSpy).toHaveBeenCalledWith('/api/quiz-grade', expect.any(Object));
  });

  it('falls back to half credit when AI grading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const out = await gradeSceneFully('s4', [makeShortQ('q1', 2)], { q1: 'x' }, 'zh-CN');
    expect(out[0].earned).toBe(1); // round(2 * 0.5) = 1
    expect(out[0].status).toBe('incorrect');
    expect(out[0].aiComment).toContain('暂时不可用');
  });

  it('returns empty array when no answers are provided', async () => {
    const out = await gradeSceneFully('s5', [makeChoiceQ('q1', 'A')], {}, 'zh-CN');
    expect(out).toEqual([]);
  });
});
