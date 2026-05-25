import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<object>('next/server');

  return {
    ...actual,
    after: (callback: () => void) => callback(),
  };
});

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mistake-job-123'),
}));

vi.mock('@/lib/mistake/openmaic/build-requirement', () => ({
  buildMistakeClassroomRequirement: vi.fn(() => 'mock requirement'),
}));

vi.mock('@/lib/server/classroom-job-store', () => ({
  createClassroomGenerationJob: vi.fn(async () => ({
    id: 'mistake-job-123',
    status: 'queued',
    step: 'queued',
    message: 'Classroom generation job queued',
  })),
}));

vi.mock('@/lib/server/classroom-job-runner', () => ({
  runClassroomGenerationJob: vi.fn(async () => undefined),
}));

vi.mock('@/lib/server/classroom-storage', async () => {
  const actual = await vi.importActual<object>('@/lib/server/classroom-storage');

  return {
    ...actual,
    buildRequestOrigin: vi.fn(() => 'http://localhost:3000'),
  };
});

import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';
import { POST } from './route';

describe('POST /api/mistake/session/generate-classroom', () => {
  beforeEach(() => {
    delete process.env.MISTAKE_CLASSROOM_MODEL;
    delete process.env.MISTAKE_OCR_MODEL;
    delete process.env.DEFAULT_MODEL;
  });

  it('creates a classroom generation job from confirmed mistake input', async () => {
    const request = new Request('http://localhost/api/mistake/session/generate-classroom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        grade: 4,
        subject: 'math',
        source: 'photo',
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswer: '63',
      }),
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json).toEqual({
      success: true,
      jobId: 'mistake-job-123',
      status: 'queued',
      step: 'queued',
      message: 'Classroom generation job queued',
      pollUrl: 'http://localhost:3000/api/generate-classroom/mistake-job-123',
      pollIntervalMs: 5000,
      requirementPreview: 'mock requirement',
    });
  });

  it('returns 400 when problemText is missing', async () => {
    const request = new Request('http://localhost/api/mistake/session/generate-classroom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        grade: 4,
        subject: 'math',
        source: 'photo',
        problemText: '',
      }),
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('请求体字段不合法');
  });

  it('stores session binding on the classroom job input summary', async () => {
    const request = new Request('http://localhost/api/mistake/session/generate-classroom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        grade: 4,
        subject: 'math',
        source: 'photo',
        problemText: '36 + 27 = ?',
      }),
    });

    await POST(request as never);

    expect(createClassroomGenerationJob).toHaveBeenCalledWith(
      'mistake-job-123',
      expect.objectContaining({
        requirement: expect.any(String),
      }),
      { sessionId: 'session-1' },
    );
  });

  it('prefers mistake-specific model config when creating the classroom job', async () => {
    process.env.MISTAKE_OCR_MODEL = 'kimi:moonshotai/kimi-k2.6';

    const request = new Request('http://localhost/api/mistake/session/generate-classroom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        grade: 4,
        subject: 'math',
        source: 'photo',
        problemText: '36 + 27 = ?',
      }),
    });

    await POST(request as never);

    expect(createClassroomGenerationJob).toHaveBeenCalledWith(
      'mistake-job-123',
      expect.objectContaining({
        modelString: 'kimi:moonshotai/kimi-k2.6',
      }),
      { sessionId: 'session-1' },
    );
  });
});
