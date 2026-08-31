// /api/admin/classroom/[id]
//
//   DELETE  — remove a classroom (JSON metadata + extracted media directory).
//   PATCH   — edit user-facing metadata (stage.name, stage.description).
//
// Imported classrooms show up with id prefix `cm_imp_`, but the
// endpoint accepts any valid classroom id since the mistake-session
// flow may also produce records the admin wants to clean up.

import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withAdminAuth } from '@/lib/admin/with-auth';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  CLASSROOMS_DIR,
  isValidClassroomId,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminClassroomEdit');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

export const DELETE = withAdminAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
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
});

// PATCH /api/admin/classroom/[id]
//
// Body (all fields optional, at least one required):
//   { "name": "新标题" }
//   { "description": "新描述" }
//   { "name": "...", "description": "..." }
//
// Updates `stage.name` and/or `stage.description` on the persisted
// classroom JSON. Other fields (scenes, media paths, etc.) are
// forwarded verbatim so we never lose data.
export const PATCH = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  if (!isValidClassroomId(id)) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'invalid classroom id');
  }

  const jsonPath = path.join(CLASSROOMS_DIR, `${id}.json`);
  if (!(await pathExists(jsonPath))) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'classroom not found');
  }

  // Parse + validate body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'body must be JSON');
  }
  if (!body || typeof body !== 'object') {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'body must be an object');
  }
  const { name: rawName, description: rawDescription } = body as {
    name?: unknown;
    description?: unknown;
  };

  const hasName = rawName !== undefined;
  const hasDescription = rawDescription !== undefined;
  if (!hasName && !hasDescription) {
    return apiError(
      API_ERROR_CODES.INVALID_REQUEST,
      400,
      'at least one of "name" or "description" must be provided',
    );
  }

  // Normalise name. Empty string is allowed and means "clear title",
  // but the field is then omitted from the JSON rather than stored
  // as "" so the public list falls back to "未命名课件" instead of
  // showing a blank card.
  let newName: string | null | undefined;
  if (hasName) {
    if (typeof rawName !== 'string') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '"name" must be a string');
    }
    const trimmed = rawName.trim();
    if (trimmed.length > NAME_MAX) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        `"name" must be ${NAME_MAX} chars or fewer`,
      );
    }
    newName = trimmed.length > 0 ? trimmed : null; // null = clear
  }

  // Normalise description. null / empty / undefined → clear.
  let newDescription: string | null | undefined;
  if (hasDescription) {
    if (rawDescription !== null && typeof rawDescription !== 'string') {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '"description" must be a string or null',
      );
    }
    const trimmed = typeof rawDescription === 'string' ? rawDescription.trim() : '';
    if (trimmed.length > DESCRIPTION_MAX) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        `"description" must be ${DESCRIPTION_MAX} chars or fewer`,
      );
    }
    newDescription = trimmed.length > 0 ? trimmed : null;
  }

  // Read-modify-write.
  let existing: Record<string, unknown>;
  try {
    const text = await fs.readFile(jsonPath, 'utf-8');
    existing = JSON.parse(text.replace(/^\uFEFF/, '')) as Record<string, unknown>;
  } catch (err) {
    log.error(`failed to read classroom [id=${id}]:`, err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'failed to read classroom',
      err instanceof Error ? err.message : String(err),
    );
  }

  const stage = (existing.stage as Record<string, unknown> | undefined) ?? {};
  let changed = false;

  if (hasName) {
    if (newName === null) {
      if ('name' in stage) {
        delete stage.name;
        changed = true;
      }
    } else if (stage.name !== newName) {
      stage.name = newName;
      changed = true;
    }
  }
  if (hasDescription) {
    if (newDescription === null) {
      if ('description' in stage) {
        delete stage.description;
        changed = true;
      }
    } else if (stage.description !== newDescription) {
      stage.description = newDescription;
      changed = true;
    }
  }

  // No-op fast path.
  if (!changed) {
    return apiSuccess({
      id,
      name: typeof stage.name === 'string' ? stage.name : null,
      description: typeof stage.description === 'string' ? stage.description : null,
      changed: false,
    });
  }

  existing.stage = stage;

  try {
    await writeJsonFileAtomic(jsonPath, existing);
  } catch (err) {
    log.error(`failed to write classroom [id=${id}]:`, err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'failed to update classroom',
      err instanceof Error ? err.message : String(err),
    );
  }

  log.info(`classroom ${id} metadata updated`);
  return apiSuccess({
    id,
    name: typeof stage.name === 'string' ? stage.name : null,
    description: typeof stage.description === 'string' ? stage.description : null,
    changed: true,
  });
});

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
