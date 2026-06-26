import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mistake-book/[id]/toggle-resolved
 *
 * Flip the `isResolved` flag for one of the current visitor's saved
 * mistakes. We read the row, verify ownership, and write the
 * inverse. We deliberately do NOT upsert / create — if the id does
 * not exist, or belongs to another visitor, we 404.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json(
      { success: false, error: 'No visitor session' },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  const existing = db.mistakeBook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    );
  }
  if (existing.visitorId !== visitorId) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const next = existing.isResolved === 1 ? 0 : 1;
  const updated = db.mistakeBook.update({
    where: { id },
    data: {
      isResolved: next,
      resolvedAt: next === 1 ? nowIso : null,
      updatedAt: nowIso,
    },
  });

  return NextResponse.json({ success: true, item: updated });
}
