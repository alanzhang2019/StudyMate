// DELETE /api/admin/classroom/[id]
//
// Removes a classroom (JSON metadata + extracted media directory).
// Imported classrooms show up with id prefix `cm_imp_`, but the
// endpoint accepts any valid classroom id since the mistake-session
// flow may also produce records the admin wants to clean up.

import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  CLASSROOMS_DIR,
  isValidClassroomId,
} from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminClassroomDelete');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidClassroomId(id)) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'invalid classroom id');
  }

  const jsonPath = path.join(CLASSROOMS_DIR, `${id}.json`);
  const mediaDir = path.join(CLASSROOMS_DIR, id);

  const exists = await pathExists(jsonPath);
  if (!exists) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'classroom not found');
  }

  try {
    // 1. remove the JSON metadata
    await fs.unlink(jsonPath);
    // 2. remove the media directory (best-effort; ignore if missing)
    try {
      await fs.rm(mediaDir, { recursive: true, force: true });
    } catch (rmErr) {
      log.warn(`media dir cleanup failed for ${id}:`, rmErr);
    }
    return apiSuccess({ id, deleted: true });
  } catch (err) {
    log.error(`classroom delete failed [id=${id}]:`, err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'failed to delete classroom',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
