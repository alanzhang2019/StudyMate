import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    cspPlacement: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateAi: vi.fn(),
    },
  },
}));

vi.mock('@/lib/server/csp-placement', () => ({
  combinedLevel: vi.fn(() => 'intermediate'),
  FALLBACK_RECOMMENDATIONS: {
    beginner: ['cm_imp_a39914d3af5c64d6'],
    intermediate: ['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1'],
    advanced: ['cm_imp_cspj2024j_v1'],
  },
}));

vi.mock('@/lib/server/csp-placement-llm', () => ({
  recommendClassrooms: vi.fn(async () => ({
    level: 'intermediate',
    recommendedIds: ['cm_ai_1'],
    aiReason: 'AI 点评：基础不错。',
    aiStatus: 'ok' as const,
  })),
}));

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { GET, POST } from './route';

type AuthMock = ReturnType<typeof vi.fn>;
type FindUniqueMock = ReturnType<typeof vi.fn>;
type UpsertMock = ReturnType<typeof vi.fn>;
type UpdateAiMock = ReturnType<typeof vi.fn>;
type RecommendMock = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/csp-quiz/placement', () => {
  it('returns 401 when not signed in', async () => {
    (auth as AuthMock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns null placement when no record exists', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    (db.cspPlacement.findUnique as FindUniqueMock).mockReturnValue(null);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.placement).toBeNull();
  });

  it('returns parsed placement when record exists', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    (db.cspPlacement.findUnique as FindUniqueMock).mockReturnValue({
      userId: 'u1',
      grade: '初二',
      studyMonths: '6-12',
      selfRating: 'mid',
      goal: 'pass-j1',
      hoursPerWeek: '2-5',
      province: '北京',
      cspJ1Year: 2024,
      cspJ1Score: 42,
      cspS1Year: null,
      cspS1Score: null,
      cspJ2Year: null,
      cspJ2Rank: null,
      cspS2Year: null,
      cspS2Rank: null,
      gespYear: null,
      gespLevel: null,
      gespPassed: null,
      otherContests: null,
      level: 'intermediate',
      recommendedIds: '["cm_x","cm_y"]',
      aiReason: '点评',
      aiStatus: 'ok',
      createdAt: '2025-12-08T00:00:00Z',
      updatedAt: '2025-12-08T00:00:00Z',
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.placement.level).toBe('intermediate');
    expect(json.placement.recommendedIds).toEqual(['cm_x', 'cm_y']);
    expect(json.placement.cspJ1).toEqual({ year: 2024, score: 42 });
  });
});

describe('POST /api/csp-quiz/placement', () => {
  it('returns 401 when not signed in', async () => {
    (auth as AuthMock).mockResolvedValue(null);
    const req = new Request('http://test/api', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when 基础 5 题 missing', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grade: '初二' }), // missing 4 required
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('upserts placement + returns recommendation on success', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grade: '初二',
        studyMonths: '6-12',
        selfRating: 'mid',
        goal: 'pass-j1',
        hoursPerWeek: '2-5',
        province: null,
        cspJ1: { year: 2024, score: 42 },
        cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.aiStatus).toBe('ok');
    expect(json.recommendedIds).toEqual(['cm_ai_1']);
    expect(db.cspPlacement.upsert as UpsertMock).toHaveBeenCalledTimes(1);
    expect(db.cspPlacement.updateAi as UpdateAiMock).toHaveBeenCalledWith(
      'u1',
      expect.stringContaining('AI 点评'),
      JSON.stringify(['cm_ai_1']),
      'ok',
      expect.any(String),
    );
  });

  it('uses fallback recommendedIds when LLM returns fallback', async () => {
    const { recommendClassrooms } = await import('@/lib/server/csp-placement-llm');
    (recommendClassrooms as RecommendMock).mockResolvedValueOnce({
      level: 'intermediate',
      recommendedIds: ['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1'],
      aiReason: '根据基础画像，暂未生成定制推荐。',
      aiStatus: 'fallback' as const,
    });
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grade: '初二',
        studyMonths: '6-12',
        selfRating: 'mid',
        goal: 'pass-j1',
        hoursPerWeek: '2-5',
        province: null,
        cspJ1: null, cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.aiStatus).toBe('fallback');
    expect(json.recommendedIds).toEqual(['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1']);
  });

  it('returns 400 when cspJ1 score is out of range', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grade: '初二',
        studyMonths: '6-12',
        selfRating: 'mid',
        goal: 'pass-j1',
        hoursPerWeek: '2-5',
        province: null,
        cspJ1: { year: 2024, score: 150 }, // invalid
        cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when cspJ2 rank is invalid', async () => {
    (auth as AuthMock).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grade: '初二',
        studyMonths: '6-12',
        selfRating: 'mid',
        goal: 'pass-j1',
        hoursPerWeek: '2-5',
        province: null,
        cspJ1: null, cspS1: null,
        cspJ2: { year: 2024, rank: '世界冠军' }, // invalid
        cspS2: null, gesp: null, otherContests: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
