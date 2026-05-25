import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mistake/session/store', () => ({
  createMistakeSession: vi.fn(async () => ({
    id: 'session-1',
    source: 'photo',
    ocr: { problemText: '36 + 27 = ?', confidence: 0.92 },
    confirmed: { problemText: '36 + 27 = ?', studentAnswer: '53', correctAnswer: '63' },
    status: 'ready_to_generate',
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
  })),
}));

import { POST } from './route';

describe('POST /api/mistake/session', () => {
  it('creates a mistake session and returns the live URL', async () => {
    const request = new Request('http://localhost/api/mistake/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'photo',
        ocr: {
          problemText: '36 + 27 = ?',
          studentAnswer: '53',
          correctAnswerCandidate: '63',
          confidence: 0.92,
        },
        confirmed: {
          problemText: '36 + 27 = ?',
          studentAnswer: '53',
          correctAnswer: '63',
        },
        status: 'ready_to_generate',
      }),
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      success: true,
      session: expect.objectContaining({
        id: 'session-1',
        status: 'ready_to_generate',
      }),
      liveUrl: 'http://localhost/mistake/session/session-1',
    });
  });
});
