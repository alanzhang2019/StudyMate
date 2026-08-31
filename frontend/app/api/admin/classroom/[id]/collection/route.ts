// POST /api/admin/classroom/[id]/collection
//
// Move a classroom into / out of a named collection (e.g. the
// "csp-lecture" public module). The `collection` field on the
// persisted JSON gates which public list page (`/csp-lecture` etc.)
// the classroom appears on, and the import flow tags it
// automatically when the upload form is submitted from
// `/admin/csp-lecture`. This endpoint exists to *re-tag* an
// already-imported classroom that landed in the default pool (e.g.
// was uploaded from `/admin/classroom`) without needing to delete
// + re-upload the .maic.zip.
//
// Body:
//   { "collection": "csp-lecture" }   // move into collection
//   { "collection": "" }              // clear tag → default pool
//   { "collection": null }            // clear tag → default pool
//
// Only the collection values defined in `KNOWN_COLLECTIONS` are
// accepted; arbitrary strings are rejected with 400 to keep the
// public filter pages from accidentally rendering a typo'd bucket.

import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withAdminAuth } from '@/lib/admin/with-auth';
import {
  apiError,
  apiSuccess,
  API_ERROR_CODES,
} from '@/lib/server/api-response';
import {
  CLASSROOMS_DIR,
  isValidClassroomId,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminClassroomCollection');

// Whitelist of recognised collection keys. Mirrors the values
// referenced from `app/csp-lecture/page.tsx` and
// `app/admin/csp-lecture/page.tsx`. Extend here when a new
// dedicated module page is added.
const KNOWN_COLLECTIONS: ReadonlySet<string> = new Set(['csp-lecture']);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdminAuth(async (
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

  // Parse body. Accept either { collection: "..." } or { collection: null }.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'body must be JSON');
  }
  if (!body || typeof body !== 'object') {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'body must be an object');
  }
  const raw = (body as { collection?: unknown }).collection;
  if (raw !== null && raw !== undefined && typeof raw !== 'string') {
    return apiError(
      API_ERROR_CODES.INVALID_REQUEST,
      400,
      'collection must be a string, null, or omitted',
    );
  }

  // Normalise:
  //   "  csp-lecture  " → "csp-lecture"
  //   "" / null        → undefined (clear)
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length > 0) {
    if (trimmed.length > 64) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        'collection key must be 64 chars or fewer',
      );
    }
    if (!KNOWN_COLLECTIONS.has(trimmed)) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        `unknown collection "${trimmed}". known: ${[...KNOWN_COLLECTIONS].join(', ')}`,
      );
    }
  }
  const newCollection: string | undefined = trimmed.length > 0 ? trimmed : undefined;

  // Read-modify-write. We do NOT trust any field other than `id` /
  // `collection`; the rest of the file is forwarded verbatim so we
  // never lose scenes, audio paths, etc.
  let existing: Record<string, unknown>;
  try {
    const text = await fs.readFile(jsonPath, 'utf-8');
    // Tolerate UTF-8 BOM (PowerShell ConvertTo-Json emits one).
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

  // No-op fast path: already in the requested state.
  if ((existing.collection as string | undefined) === newCollection) {
    return apiSuccess({
      id,
      collection: newCollection ?? null,
      changed: false,
    });
  }

  if (newCollection) {
    existing.collection = newCollection;
  } else {
    delete existing.collection;
  }

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

  log.info(`classroom ${id} moved to collection: ${newCollection ?? '(default pool)'}`);
  return apiSuccess({
    id,
    collection: newCollection ?? null,
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
