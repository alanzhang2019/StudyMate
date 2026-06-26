import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor/server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/mistake-book/[id]
 *
 * Permanently remove one of the current visitor's saved mistakes.
 * Same ownership check as toggle-resolved: if the row belongs to a
 * different visitor, 403.
 */
export async function DELETE(
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

  db.mistakeBook.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
