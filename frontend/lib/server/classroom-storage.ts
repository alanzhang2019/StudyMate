import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';

// Resolve classrooms directory at module load. In production
// (Docker) the named volume is mounted at `/app/data` and
// `STUDYMATE_DB_DIR=/app/data` is set in docker-compose.yml.
// In dev, no env var is set, so we fall back to the project
// root's `data/classrooms/` directory.
//
// We intentionally do NOT rely on `process.cwd()` alone even
// though WORKDIR=/app in the Dockerfile should make them
// equivalent — using the explicit env var matches `lib/db.ts`
// and survives any future change to the entrypoint that might
// alter the cwd (e.g. a wrapper that `chdir`s before `node
// server.js`).
export const CLASSROOMS_DIR = process.env.STUDYMATE_DB_DIR
  ? path.join(process.env.STUDYMATE_DB_DIR, 'classrooms')
  : path.join(process.cwd(), 'data', 'classrooms');
export const CLASSROOM_JOBS_DIR = process.env.STUDYMATE_DB_DIR
  ? path.join(process.env.STUDYMATE_DB_DIR, 'classroom-jobs')
  : path.join(process.cwd(), 'data', 'classroom-jobs');
export const MISTAKE_SESSIONS_DIR = process.env.STUDYMATE_DB_DIR
  ? path.join(process.env.STUDYMATE_DB_DIR, 'mistake-sessions')
  : path.join(process.cwd(), 'data', 'mistake-sessions');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureClassroomsDir() {
  await ensureDir(CLASSROOMS_DIR);
}

export async function ensureClassroomJobsDir() {
  await ensureDir(CLASSROOM_JOBS_DIR);
}

export async function ensureMistakeSessionsDir() {
  await ensureDir(MISTAKE_SESSIONS_DIR);
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export function buildRequestOrigin(req: NextRequest): string {
  return req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin;
}

export interface PersistedClassroomData {
  id: string;
  stage: Stage;
  scenes: Scene[];
  createdAt: string;
  /**
   * Optional logical grouping key (e.g. "csp-lecture" for the
   * "CSP初赛要点精讲" collection). Omitted / empty means it belongs
   * to the default global classroom pool. Collections are mutually
   * exclusive at the classroom level — a classroom lives in at most
   * one collection.
   */
  collection?: string;
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function readClassroom(id: string): Promise<PersistedClassroomData | null> {
  const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as PersistedClassroomData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// listClassroomSummaries returns lightweight metadata for every
// classroom on disk, optionally filtered by `collection` (e.g.
// 'csp-lecture'). Used by the student-progress overview API to
// compute the "未开始" list without re-reading every classroom
// file twice. We deliberately return only fields the API needs
// (id, title, sceneCount, collection) — not the full
// PersistedClassroomData — to keep the payload small.
export async function listClassroomSummaries(
  collection?: string,
): Promise<{ id: string; title: string; sceneCount: number; collection?: string }[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(CLASSROOMS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: { id: string; title: string; sceneCount: number; collection?: string }[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    const filePath = path.join(CLASSROOMS_DIR, name);
    try {
      // Strip UTF-8 BOM (PowerShell's ConvertTo-Json emits one)
      // and parse with a permissive shape — fields like `title`
      // and `scenes` may live in either `data` or `data.stage`
      // depending on importer, so we probe both.
      const raw = (await fs.readFile(filePath, 'utf-8')).replace(/^\ufeff/, '');
      const data = JSON.parse(raw) as {
        id: string;
        title?: string;
        name?: string;
        collection?: string;
        scenes?: unknown[];
        stage?: { title?: string; name?: string; scenes?: unknown[] };
      };
      if (collection && data.collection !== collection) continue;
      const title =
        data.title ?? data.name ?? data.stage?.title ?? data.stage?.name ?? id;
      const sceneCount =
        (Array.isArray(data.scenes) ? data.scenes.length : 0) ||
        (Array.isArray(data.stage?.scenes) ? (data.stage!.scenes as unknown[]).length : 0);
      out.push({ id, title, sceneCount, collection: data.collection });
    } catch {
      // Skip unreadable / malformed classroom files instead of
      // failing the whole list.
    }
  }
  return out;
}

export async function persistClassroom(
  data: {
    id: string;
    stage: Stage;
    scenes: Scene[];
    collection?: string;
  },
  baseUrl: string,
): Promise<PersistedClassroomData & { url: string }> {
  const classroomData: PersistedClassroomData = {
    id: data.id,
    stage: data.stage,
    scenes: data.scenes,
    createdAt: new Date().toISOString(),
    collection: data.collection?.trim() || undefined,
  };

  await ensureClassroomsDir();
  const filePath = path.join(CLASSROOMS_DIR, `${data.id}.json`);
  await writeJsonFileAtomic(filePath, classroomData);

  return {
    ...classroomData,
    url: `${baseUrl}/classroom/${data.id}`,
  };
}
