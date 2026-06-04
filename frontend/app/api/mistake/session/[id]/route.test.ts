import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mistake/session/store', () => ({
  readMistakeSession: vi.fn(async (id: string) =>
    id === 'session-1'
      ? {
          id: 'session-1',
          source: 'photo',
          ocr: { problemText: '36 + 27 = ?', confidence: 0.92 },
          confirmed: { problemText: '36 + 27 = ?', studentAnswer: '53', correctAnswer: '63' },
          status: 'live',
          classroomId: 'classroom-1',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }
      : null,
  ),
  updateMistakeSession: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
    id,
    source: 'photo',
    ocr: { problemText: '36 + 27 = ?', confidence: 0.92 },
    confirmed: { problemText: '36 + 27 = ?', studentAnswer: '53', correctAnswer: '63' },
    status: patch.status ?? 'live',
    classroomId: patch.classroomId ?? 'classroom-1',
    explanationSummary: patch.explanationSummary,
    parentSummary: patch.parentSummary,
    masteryStatus: patch.masteryStatus,
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
  })),
}));

import { GET, PATCH } from './route';

describe('GET /api/mistake/session/[id]', () => {
  it('returns the stored session', async () => {
    const request = new Request('http://localhost/api/mistake/session/session-1');
    const response = await GET(request as never, {
      params: Promise.resolve({ id: 'session-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.session.classroomId).toBe('classroom-1');
  });

  it('updates classroomId on an existing mistake session', async () => {
    const request = new Request('http://localhost/api/mistake/session/session-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        classroomId: 'classroom-2',
        status: 'completed',
      }),
    });
    const response = await PATCH(request as never, {
      params: Promise.resolve({ id: 'session-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.session.classroomId).toBe('classroom-2');
    expect(json.session.status).toBe('completed');
  });

  it('accepts explanation and parent summary fields', async () => {
    const request = new Request('http://localhost/api/mistake/session/session-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        explanationSummary: {
          stuckPoint: '数量关系没找对',
          whyStuck: '没有先找总数和每份数',
          howToThink: '先看总数，再看分成几份',
          nextTimeTip: '先找关键关系再列式',
        },
        parentSummary: {
          totalCount: 1,
          solvedCount: 0,
          needMoreReason: '数量关系还不稳',
          focusTopic: '除法应用题',
        },
        masteryStatus: 'pending',
      }),
    });
    const response = await PATCH(request as never, {
      params: Promise.resolve({ id: 'session-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.session.explanationSummary.stuckPoint).toBe('数量关系没找对');
    expect(json.session.parentSummary.focusTopic).toBe('除法应用题');
    expect(json.session.masteryStatus).toBe('pending');
  });
});
