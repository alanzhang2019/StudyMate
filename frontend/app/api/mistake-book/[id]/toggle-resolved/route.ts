import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { canMarkMastered } from '@/lib/mistake-book/review';
import { getVisitorId } from '@/lib/visitor/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mistake-book/[id]/toggle-resolved
 *
 * Flip the `isResolved` flag for one of the current visitor's saved
 * mistakes. We read the row, verify ownership, and write the
 * inverse. We deliberately do NOT upsert / create — if the id does
 * not exist, or belongs to another visitor, we 404.
 *
 * 2026-07-02 错题三段复盘改造:
 *   - "标记为已掌握" 方向现在需要三段复盘已完成 (reviewedAt set),
 *     否则 409. 防止学生绕过复盘直接 toggle.
 *   - "撤销" (resolved=1 → 0) 不受限制, 任何时候都可以撤销.
 *   - force=true 表示"强制设置目标值", body 中用 `resolved: 0|1`.
 *     用于 admin/数据迁移, 跳过守卫.
 *
 * Body: { force?: boolean, resolved?: 0|1 }
 */
export async function POST(
  req: Request,
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

  let body: { force?: unknown; resolved?: unknown } = {};
  try {
    body = (await req.json()) as { force?: unknown; resolved?: unknown };
  } catch {
    // no body — defaults to plain toggle
  }
  const force = body.force === true;
  const explicitTarget =
    body.resolved === 1 || body.resolved === 0
      ? (body.resolved as 0 | 1)
      : null;

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

  // 推导目标值: 显式 > toggle 默认
  const next: 0 | 1 =
    explicitTarget !== null
      ? explicitTarget
      : existing.isResolved === 1
        ? 0
        : 1;

  // 守卫: 把"未掌握"翻成"已掌握"时, 必须三段复盘都完成 (除非 force).
  // 撤销方向 (1 -> 0) 永远放行.
  if (!force && existing.isResolved === 0 && next === 1) {
    if (!canMarkMastered(existing)) {
      return NextResponse.json(
        {
          success: false,
          error: '请先完成三段复盘 (错因 + AI 正解 + 同类变式) 再标记掌握',
          code: 'review_incomplete',
        },
        { status: 409 },
      );
    }
  }

  const nowIso = new Date().toISOString();
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
