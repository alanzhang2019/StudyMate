import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn(async () => ({
    model: { modelId: 'mock-model' },
    modelString: 'minimax:MiniMax-Text-01',
    providerId: 'minimax',
    modelId: 'MiniMax-Text-01',
  })),
}));

import { callLLM } from '@/lib/ai/llm';
import { recommendClassrooms } from './csp-placement-llm';

const baseAnswers = {
  grade: '初二',
  studyMonths: '6-12' as const,
  selfRating: 'mid' as const,
  goal: 'pass-j1' as const,
  hoursPerWeek: '2-5' as const,
  province: '北京' as string | null,
  cspJ1: { year: 2024, score: 42 },
  cspS1: null,
  cspJ2: null,
  cspS2: null,
  gesp: null,
  otherContests: null as string | null,
};

describe('recommendClassrooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed LLM response on success', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        level: 'intermediate',
        recommendedIds: ['cm_a', 'cm_b', 'cm_c'],
        reason: '你的基础不错，建议从专项题开始。',
      }),
    });

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: baseAnswers.cspJ1 });

    expect(result.aiStatus).toBe('ok');
    expect(result.level).toBe('intermediate');
    expect(result.recommendedIds).toEqual(['cm_a', 'cm_b', 'cm_c']);
    expect(result.aiReason).toContain('基础');
  });

  it('strips markdown code fences from LLM response', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: '```json\n' + JSON.stringify({
        level: 'advanced',
        recommendedIds: ['cm_imp_cspj2024j_v1'],
        reason: '你已经具备复赛水平，建议直接刷真题。',
      }) + '\n```',
    });

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: baseAnswers.cspJ1 });
    expect(result.aiStatus).toBe('ok');
    expect(result.level).toBe('advanced');
    expect(result.recommendedIds).toEqual(['cm_imp_cspj2024j_v1']);
  });

  it('falls back when LLM throws', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: null });
    expect(result.aiStatus).toBe('fallback');
    expect(result.recommendedIds.length).toBeGreaterThan(0);
    // mid selfRating + no contests → intermediate
    expect(result.level).toBe('intermediate');
    expect(result.aiReason).toContain('暂未生成');
  });

  it('falls back when LLM returns invalid JSON', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'not json at all',
    });

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: null });
    expect(result.aiStatus).toBe('fallback');
  });

  it('falls back when LLM returns JSON missing required fields', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ level: 'beginner' }), // no recommendedIds, no reason
    });

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: null });
    expect(result.aiStatus).toBe('fallback');
  });

  it('falls back on soft-timeout (Promise.race)', async () => {
    // Simulate a hanging LLM call: never resolves within 5s.
    (callLLM as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => { /* never resolves */ }),
    );

    const result = await recommendClassrooms({ ...baseAnswers, cspJ1: null });
    expect(result.aiStatus).toBe('fallback');
    expect(result.recommendedIds.length).toBeGreaterThan(0);
  });

  it('combinedLevel drives fallback: cspJ1 score 55 → intermediate', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const result = await recommendClassrooms({
      ...baseAnswers,
      cspJ1: { year: 2024, score: 55 },
    });
    expect(result.aiStatus).toBe('fallback');
    expect(result.level).toBe('intermediate');
  });

  it('combinedLevel drives fallback: cspJ2 省一 → advanced', async () => {
    (callLLM as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const result = await recommendClassrooms({
      ...baseAnswers,
      selfRating: 'low',
      cspJ1: null,
      cspJ2: { year: 2024, rank: '省一' },
    });
    expect(result.aiStatus).toBe('fallback');
    expect(result.level).toBe('advanced');
  });
});
