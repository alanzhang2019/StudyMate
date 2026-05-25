import { promises as fs } from 'fs';
import path from 'path';

import { nanoid } from 'nanoid';
import { db } from '@/lib/db';

import {
  ensureMistakeSessionsDir,
  MISTAKE_SESSIONS_DIR,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';

import type { CreateMistakeSessionInput, MistakeSession } from './types';

export { MISTAKE_SESSIONS_DIR } from '@/lib/server/classroom-storage';

function sessionFilePath(sessionId: string) {
  return path.join(MISTAKE_SESSIONS_DIR, `${sessionId}.json`);
}

export async function createMistakeSession(
  input: CreateMistakeSessionInput,
): Promise<MistakeSession> {
  const now = new Date().toISOString();
  const session: MistakeSession = {
    id: nanoid(10),
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  await ensureMistakeSessionsDir();
  await writeJsonFileAtomic(sessionFilePath(session.id), session);

  if (input.studentProfileId) {
    try {
      await db.mistakeRecord.create({
        data: {
          id: session.id,
          studentId: input.studentProfileId,
          problemText: input.confirmed.problemText,
          studentAnswer: input.confirmed.studentAnswer || "",
          correctAnswer: input.confirmed.correctAnswer || "",
          imageUrl: input.imageUrl || null,
          isResolved: false
        }
      });
    } catch (err) {
      console.error("Failed to create mistake record", err);
    }
  }

  return session;
}

export async function readMistakeSession(sessionId: string): Promise<MistakeSession | null> {
  try {
    const raw = await fs.readFile(sessionFilePath(sessionId), 'utf-8');
    return JSON.parse(raw) as MistakeSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function updateMistakeSession(
  sessionId: string,
  patch: Partial<MistakeSession>,
): Promise<MistakeSession> {
  const existing = await readMistakeSession(sessionId);
  if (!existing) {
    throw new Error(`Mistake session not found: ${sessionId}`);
  }

  const updated: MistakeSession = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFileAtomic(sessionFilePath(sessionId), updated);

  if (patch.masteryStatus === 'done' && existing.studentProfileId) {
    try {
      await db.mistakeRecord.update({
        where: { id: sessionId },
        data: { isResolved: true }
      });
    } catch (err) {
      console.error("Failed to update mistake record", err);
    }
  }

  return updated;
}

export async function findMistakeSessionByClassroomId(
  classroomId: string,
): Promise<MistakeSession | null> {
  await ensureMistakeSessionsDir();
  const fileNames = await fs.readdir(MISTAKE_SESSIONS_DIR);

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const raw = await fs.readFile(path.join(MISTAKE_SESSIONS_DIR, fileName), 'utf-8');
    const session = JSON.parse(raw) as MistakeSession;

    if (session.classroomId === classroomId) {
      return session;
    }
  }

  return null;
}
