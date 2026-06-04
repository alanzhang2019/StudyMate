import { rm } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMistakeSession,
  findMistakeSessionByClassroomId,
  MISTAKE_SESSIONS_DIR,
  readMistakeSession,
  updateMistakeSession,
} from './store';

describe('mistake session store', () => {
  afterEach(async () => {
    await rm(MISTAKE_SESSIONS_DIR, { recursive: true, force: true });
  });

  it('creates and reads a draft session', async () => {
    const session = await createMistakeSession({
      source: 'photo',
      ocr: {
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswerCandidate: '63',
        confidence: 0.91,
      },
      confirmed: {
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswer: '63',
      },
      status: 'ready_to_generate',
    });

    const loaded = await readMistakeSession(session.id);
    expect(loaded?.status).toBe('ready_to_generate');
    expect(loaded?.confirmed.problemText).toBe('36 + 27 = ?');
  });

  it('updates classroom binding fields', async () => {
    const session = await createMistakeSession({
      source: 'upload',
      ocr: { problemText: '24 / 6 = ?', confidence: 0.8 },
      confirmed: { problemText: '24 / 6 = ?', correctAnswer: '4' },
      status: 'waiting_first_scene',
    });

    const updated = await updateMistakeSession(session.id, {
      classroomJobId: 'job-1',
      classroomId: 'classroom-1',
      status: 'live',
    });

    expect(updated.classroomJobId).toBe('job-1');
    expect(updated.classroomId).toBe('classroom-1');
    expect(updated.status).toBe('live');
  });

  it('finds a session by classroom id', async () => {
    const session = await createMistakeSession({
      source: 'upload',
      ocr: { problemText: '24 / 6 = ?', confidence: 0.8 },
      confirmed: { problemText: '24 / 6 = ?', correctAnswer: '4' },
      status: 'waiting_first_scene',
    });

    await updateMistakeSession(session.id, {
      classroomId: 'classroom-lookup-1',
      status: 'live',
    });

    const found = await findMistakeSessionByClassroomId('classroom-lookup-1');

    expect(found?.id).toBe(session.id);
    expect(found?.classroomId).toBe('classroom-lookup-1');
  });
});
