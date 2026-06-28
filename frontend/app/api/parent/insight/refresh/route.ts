import { NextResponse } from 'next/server';

import { getParentVisitorId } from '@/lib/parent/visitor';
import { listActiveBindingsForParent } from '@/lib/parent/invite';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/insight/refresh
 *
 * Invalidate the cached AI commentary so the next GET /api/
 * parent/dashboard regenerates it. We only wipe the most recent
 * row (the one the dashboard will read) so the action is cheap
 * and idempotent.
 */
export async function POST() {
  const parentVisitorId = await getParentVisitorId();
  if (!parentVisitorId) {
    return NextResponse.json(
      { error: '请先在家长端完成绑定' },
      { status: 401 },
    );
  }

  const bindings = listActiveBindingsForParent(parentVisitorId);
  if (bindings.length === 0) {
    return NextResponse.json({ error: '尚未绑定任何学生' }, { status: 400 });
  }

  let deleted = 0;
  for (const binding of bindings) {
    const latest = db.parentAiInsight.findFirst({
      where: { studentVisitorId: binding.studentVisitorId },
      orderBy: { generatedAt: 'desc' },
    });
    if (latest) {
      db.parentAiInsight.delete({ where: { id: latest.id } });
      deleted += 1;
    }
  }

  return NextResponse.json({ success: true, deleted });
}
