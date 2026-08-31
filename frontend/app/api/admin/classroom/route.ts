// GET /api/admin/classroom
//
// List all persisted classrooms (created by mistake-session flow OR
// imported via the admin import flow). Admin-only.
//
// Optional query string:
//   ?collection=csp-lecture   Filter to a single collection tag.
//                             "default" / missing → no filter.
//                             "__none__" → only classrooms with no collection tag.

import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withAdminAuth } from '@/lib/admin/with-auth';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminClassroomList');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    // Optional collection filter
    const collectionParam = request.nextUrl.searchParams.get('collection');
    const collectionFilter =
      collectionParam && collectionParam.trim().length > 0
        ? collectionParam.trim()
        : null;

    let entries: string[] = [];
    try {
      entries = await fs.readdir(CLASSROOMS_DIR);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // No classrooms yet — return empty list, not an error.
        return apiSuccess({ items: [], total: 0 });
      }
      throw err;
    }

    const items: Array<{
      id: string;
      title: string;
      description?: string;
      language?: string;
      style?: string;
      sceneCount: number;
      createdAt: string;
      imported: boolean;
      collection?: string;
    }> = [];

    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -'.json'.length);
      const filePath = path.join(CLASSROOMS_DIR, name);
      try {
        // Strip UTF-8 BOM if present — external scripts (PowerShell's
        // `ConvertTo-Json` etc.) sometimes write one, and `JSON.parse`
        // rejects it as a syntax error.
        const raw = (await fs.readFile(filePath, 'utf-8')).replace(/^\ufeff/, '');
        const data = JSON.parse(raw) as {
          id: string;
          stage: { name: string; description?: string; languageDirective?: string; style?: string };
          scenes: unknown[];
          createdAt: string;
          collection?: string;
        };
        const itemCollection = data.collection || undefined;
        // Apply collection filter (post-parse because the file layout
        // makes that a single readdir anyway).
        if (collectionFilter === '__none__') {
          if (itemCollection) continue;
        } else if (collectionFilter) {
          if (itemCollection !== collectionFilter) continue;
        }
        items.push({
          id: data.id || id,
          title: data.stage?.name ?? 'Untitled',
          description: data.stage?.description,
          language: data.stage?.languageDirective,
          style: data.stage?.style,
          sceneCount: Array.isArray(data.scenes) ? data.scenes.length : 0,
          createdAt: data.createdAt,
          imported: id.startsWith('cm_imp_'),
          collection: itemCollection,
        });
      } catch (err) {
        log.warn(`failed to read classroom file ${name}:`, err);
        // Skip — partial / corrupted file shouldn't break the whole list.
      }
    }

    // Newest first
    items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return apiSuccess({ items, total: items.length });
  } catch (err) {
    log.error('classroom list failed:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'failed to list classrooms',
      err instanceof Error ? err.message : String(err),
    );
  }
});
