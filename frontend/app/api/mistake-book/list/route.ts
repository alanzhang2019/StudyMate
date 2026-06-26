import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mistake-book/list
 *
 * Returns the current visitor's saved mistakes, newest first.
 * Optional query params:
 *   - includeResolved=true: include resolved items (default: false)
 *   - limit: 1-200 (default 100)
 *   - offset: pagination offset (default 0)
 *
 * Read-only — does NOT mint a visitor id. If the visitor has no
 * cookie yet, we return an empty list (the page handles "you have
 * nothing saved" UX locally).
 */
export async function GET(req: Request) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json({
      success: true,
      items: [],
      total: 0,
      unresolved: 0,
    });
  }

  const url = new URL(req.url);
  const includeResolved = url.searchParams.get('includeResolved') === 'true';
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get('limit') ?? 100)),
  );
  // The generic findMany helper only supports `take` (no offset /
  // cursor). For an MVP list page this is fine: each visitor's
  // collection will be small in practice (tens of items), so we
  // simply return the first 100. The `hasMore` flag flips when the
  // page is full so the UI can show a "you have many saved
  // items, narrow the filter" hint.
  const where: Record<string, unknown> = { visitorId };
  if (!includeResolved) {
    where.isResolved = 0;
  }

  const items = db.mistakeBook.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const total = db.mistakeBook.count({ where: { visitorId } });
  const unresolved = db.mistakeBook.count({
    where: { visitorId, isResolved: 0 },
  });

  return NextResponse.json({
    success: true,
    items,
    total,
    unresolved,
    pagination: { limit, hasMore: items.length === limit },
  });
}
