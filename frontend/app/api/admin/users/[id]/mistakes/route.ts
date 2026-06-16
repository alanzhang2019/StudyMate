import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
      200,
    );
    const offset = Math.max(
      parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
      0,
    );
    const includeResolved = url.searchParams.get('includeResolved') !== '0';

    // Confirm the user exists so we can return a clean 404 instead of an
    // empty list when an admin types the wrong id.
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, errorCode: 'NOT_FOUND', error: 'User not found' },
        { status: 404 },
      );
    }

    const all = await db.mistakeRecord.findMany({
      where: { parentId: id },
      orderBy: { createdAt: 'desc' },
    });
    const filtered = includeResolved
      ? all
      : all.filter(
          (m: any) => !(m.isResolved === 1 || m.isResolved === true),
        );

    const items = filtered.slice(offset, offset + limit);

    // Look up the student name for each mistake. The Prisma-compat shim
    // does not support `findMany({ where: { id: { in: [...] } } })`, so we
    // do N small lookups here. With LIMIT 50 max this is fine for an
    // admin-only page; if usage grows we can switch to a single
    // SELECT ... IN (?, ?, ...) through a dedicated helper.
    const studentMap = new Map<string, any>();
    for (const m of items as any[]) {
      if (m.studentId && !studentMap.has(m.studentId)) {
        const s = await db.studentProfile.findUnique({
          where: { id: m.studentId },
        });
        if (s) studentMap.set(m.studentId, s);
      }
    }

    return NextResponse.json({
      total: filtered.length,
      offset,
      limit,
      items: items.map((m: any) => ({
        ...m,
        student: m.studentId ? studentMap.get(m.studentId) ?? null : null,
      })),
    });
  } catch (err) {
    console.error('[admin/users/[id]/mistakes GET] failed:', err);
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
