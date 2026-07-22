// POST /api/admin/classroom/import
//
// Accepts a `.maic.zip` produced by the OpenMAIC export button and
// re-hydrates it into the filesystem classroom layout. Admin-only —
// the middleware already enforces `admin_token` for `/api/admin/*`.

import { type NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import {
  importClassroomZip,
} from '@/lib/server/classroom-import';
import { ClassroomImportError } from '@/lib/server/classroom-zip-types';
import {
  buildRequestOrigin,
  CLASSROOMS_DIR,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';
import { promises as fs } from 'fs';
import path from 'path';
import { trackEvent } from '@/lib/usage/track';

const log = createLogger('AdminClassroomImport');

// Node.js runtime so we can read multipart / Buffer / fs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_MB = 100;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  // ── Parse multipart ────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'request must be multipart/form-data',
      err instanceof Error ? err.message : String(err),
    );
  }
  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof File)) {
    return apiError('INVALID_REQUEST', 400, 'missing field: file');
  }
  if (fileEntry.size === 0) {
    return apiError('EMPTY_FILE', 400, 'uploaded file is empty');
  }
  if (fileEntry.size > MAX_UPLOAD_BYTES) {
    return apiError(
      'FILE_TOO_LARGE',
      413,
      `file exceeds ${MAX_UPLOAD_MB}MB cap`,
    );
  }
  const filename = (fileEntry as File).name || 'upload.zip';
  if (!filename.toLowerCase().endsWith('.zip') && !filename.toLowerCase().endsWith('.maic.zip')) {
    return apiError(
      'INVALID_FILE',
      415,
      `expected .zip or .maic.zip, got: ${filename}`,
    );
  }

  // ── Buffer + import ─────────────────────────────────────────────
  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Optional `collection` form field (e.g. "csp-lecture") tags the
  // imported classroom so it shows up on the dedicated module page
  // instead of the generic "课堂管理" pool. Empty / missing means
  // "default pool" (no tag).
  const rawCollection = formData.get('collection');
  const collection =
    typeof rawCollection === 'string' && rawCollection.trim().length > 0
      ? rawCollection.trim().slice(0, 64)
      : undefined;

  let result;
  try {
    result = await importClassroomZip(buffer, { collection });
  } catch (err) {
    if (err instanceof ClassroomImportError) {
      const httpStatus =
        err.code === 'ZIP_TOO_LARGE' || err.code === 'EMPTY_ZIP'
          ? 413
          : err.code === 'ID_COLLISION'
            ? 409
            : 400;
      return apiError(err.code as Parameters<typeof apiError>[0], httpStatus, err.message);
    }
    log.error('import failed unexpectedly:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'import failed',
      err instanceof Error ? err.message : String(err),
    );
  }

  // ── Rewrite audioUrl on every speech action so the playback
  //    engine can hit /api/classroom-media/<id>/audio/<id>.<ext> ───
  const baseUrl = buildRequestOrigin(request);
  try {
    await rewriteAudioUrls(result.id, baseUrl);
  } catch (err) {
    log.warn('audioUrl rewrite failed (audio playback will be silent):', err);
    result.warnings.push(
      `audioUrl rewrite failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Audit log ───────────────────────────────────────────────────
  void trackEvent(
    'admin.classroom.import',
    {
      classroomId: result.id,
      title: result.title,
      sceneCount: result.sceneCount,
      mediaCount: result.mediaCount,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    },
    { request },
  );

  return apiSuccess(
    {
      id: result.id,
      title: result.title,
      sceneCount: result.sceneCount,
      mediaCount: result.mediaCount,
      url: `${baseUrl}/classroom/${result.id}`,
      warnings: result.warnings,
    },
    201,
  );
}

/**
 * Post-import pass: set `audioUrl` on every speech action so the
 * playback engine can hit the static media endpoint directly without
 * an extra round-trip through `/api/classroom?id=…`.
 */
async function rewriteAudioUrls(classroomId: string, baseUrl: string): Promise<void> {
  const jsonPath = path.join(CLASSROOMS_DIR, `${classroomId}.json`);
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const data = JSON.parse(raw) as {
    scenes: Array<{
      actions?: Array<Record<string, unknown>>;
    }>;
    collection?: string;
  };
  const mediaRoot = path.join(CLASSROOMS_DIR, classroomId, 'audio');
  let audioDir: string[] = [];
  try {
    audioDir = await fs.readdir(mediaRoot);
  } catch {
    audioDir = [];
  }
  const audioIndex = new Map<string, string>();
  for (const f of audioDir) {
    const ext = path.extname(f);
    const id = f.slice(0, -ext.length);
    audioIndex.set(id, `${baseUrl}/api/classroom-media/${classroomId}/audio/${f}`);
  }
  let mutated = false;
  for (const scene of data.scenes) {
    for (const action of scene.actions ?? []) {
      if (action.type === 'speech' && action.audioId && !action.audioUrl) {
        const url = audioIndex.get(action.audioId as string);
        if (url) {
          action.audioUrl = url;
          mutated = true;
        }
      }
    }
  }
  if (mutated) {
    // Preserve top-level metadata (including `collection`) when
    // rewriting. writeJsonFileAtomic would otherwise lose the
    // collection tag if we round-tripped through a typed shape.
    await writeJsonFileAtomic(jsonPath, data);
  }
}
