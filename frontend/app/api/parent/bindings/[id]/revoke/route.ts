import { NextResponse } from 'next/server';

import { getVisitorId } from '@/lib/visitor/server';
import { getParentVisitorId } from '@/lib/parent/visitor';
import { db } from '@/lib/db';
import { revokeBinding } from '@/lib/parent/invite';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/bindings/[id]/revoke
 *
 * Body: { role: 'parent' | 'student' }
 *
 * Either party can sever a binding. We verify ownership before
 * mutating so a parent cannot revoke someone else's child and
 * vice versa.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { role } = (body ?? {}) as { role?: unknown };
  if (role !== 'parent' && role !== 'student') {
    return NextResponse.json(
      { error: 'role 必须是 parent 或 student' },
      { status: 400 },
    );
  }

  const row = db.parentBinding.findUnique({ where: { id } });
  if (!row || row.revokedAt) {
    return NextResponse.json({ error: '绑定不存在或已撤销' }, { status: 404 });
  }

  if (role === 'parent') {
    const parentVisitorId = await getParentVisitorId();
    if (row.parentVisitorId !== parentVisitorId) {
      return NextResponse.json({ error: '无权操作此绑定' }, { status: 403 });
    }
  } else {
    const studentVisitorId = await getVisitorId();
    if (row.studentVisitorId !== studentVisitorId) {
      return NextResponse.json({ error: '无权操作此绑定' }, { status: 403 });
    }
  }

  const ok = revokeBinding(id, role);
  if (!ok) {
    return NextResponse.json({ error: '撤销失败' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
