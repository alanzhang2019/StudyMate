import { NextResponse } from 'next/server';

import { getParentVisitorId } from '@/lib/parent/visitor';
import { getDashboardForParent } from '@/lib/parent/dashboard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/dashboard
 *
 * Returns the full parent dashboard payload (KPIs, charts,
 * recent mistakes, AI insight). 401 when the parent cookie is
 * missing; 400 when the parent has no active binding — the
 * page uses that to redirect to /parent/bind.
 */
export async function GET() {
  try {
  const parentVisitorId = await getParentVisitorId();
  if (!parentVisitorId) {
    return NextResponse.json(
      { error: '请先在家长端完成绑定' },
      { status: 401 },
    );
  }

  const dashboard = await getDashboardForParent(parentVisitorId);
  if (!dashboard) {
    return NextResponse.json(
      { error: '尚未绑定任何学生' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, dashboard });
} catch (err) {
  console.error('[/api/parent/dashboard] failed', err);
  return NextResponse.json(
    {
      error: '加载看板失败，请稍后重试',
      debug: err instanceof Error ? err.message : String(err),
    },
    { status: 500 },
  );
}
}
