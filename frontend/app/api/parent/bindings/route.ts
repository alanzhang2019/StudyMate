import { NextResponse } from 'next/server';

import { getVisitorId } from '@/lib/visitor/server';
import { getParentVisitorId } from '@/lib/parent/visitor';
import {
  listActiveBindingsForParent,
  listActiveBindingsForStudent,
} from '@/lib/parent/invite';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/bindings?role=parent|student
 *
 * List the active bindings for the caller. We attach a friendly
 * label (firstSeenAt) by scanning usage_events so the UI can
 * show "学生（8/12 加入）" without forcing the user to type a
 * nickname.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get('role');

  if (role !== 'parent' && role !== 'student') {
    return NextResponse.json(
      { error: 'role 必须是 parent 或 student' },
      { status: 400 },
    );
  }

  if (role === 'parent') {
    const parentVisitorId = await getParentVisitorId();
    if (!parentVisitorId) {
      return NextResponse.json({ success: true, bindings: [] });
    }
    const rows = listActiveBindingsForParent(parentVisitorId);
    const studentIds = rows.map((r) => r.studentVisitorId);
    const labels = await buildStudentLabels(studentIds);
    return NextResponse.json({
      success: true,
      bindings: rows.map((r) => ({
        id: r.id,
        studentVisitorId: r.studentVisitorId,
        createdAt: r.createdAt,
        label: labels.get(r.studentVisitorId) ?? null,
      })),
    });
  }

  // role === 'student'
  const studentVisitorId = await getVisitorId();
  if (!studentVisitorId) {
    return NextResponse.json({ success: true, bindings: [] });
  }
  const rows = listActiveBindingsForStudent(studentVisitorId);
  return NextResponse.json({
    success: true,
    bindings: rows.map((r) => ({
      id: r.id,
      parentBindingId: r.id,
      parentVisitorId: r.parentVisitorId,
      createdAt: r.createdAt,
    })),
  });
}

async function buildStudentLabels(
  visitorIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const vid of visitorIds) {
    const first = db.usageEvent.findFirst({
      where: { visitorId: vid },
      orderBy: { createdAt: 'asc' },
    });
    if (first) {
      const d = new Date(first.createdAt);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      out.set(vid, `${m}/${day} 加入`);
    }
  }
  return out;
}
