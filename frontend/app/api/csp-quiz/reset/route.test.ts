import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    cspQuizSubmission: {
      deleteByUserScene: vi.fn(() => 1),
    },
    cspProgress: {
      setCompletedAt: vi.fn(),
      findByUserClass: vi.fn(() => ({ completedAt: '2026-07-26T00:00:00Z' })),
    },
  },
}));

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/csp-quiz/reset', () => {
  it('returns 401 when not signed in', async () => {
    (auth as any).mockResolvedValue(null);
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body missing fields', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('deletes the submission row and clears completedAt when present', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(db.cspQuizSubmission.deleteByUserScene).toHaveBeenCalledWith('u1', 'c1', 's1');
    expect(db.cspProgress.setCompletedAt).toHaveBeenCalledWith('u1', 'c1', null);
  });

  it('does not call setCompletedAt when there was no completion', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    (db.cspProgress.findByUserClass as any).mockReturnValue(null);
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.cspProgress.setCompletedAt).not.toHaveBeenCalled();
  });
});
