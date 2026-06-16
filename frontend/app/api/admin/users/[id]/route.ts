import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, errorCode: 'NOT_FOUND', error: 'User not found' },
        { status: 404 },
      );
    }

    // Pull students belonging to this user directly (the Prisma-compat
    // shim doesn't do joins, so we just do a simple query).
    const students = await db.studentProfile.findMany({
      where: { parentId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate mistake stats with two cheap queries. `isResolved` is
    // stored as INTEGER (0 / 1) so SUM(CASE ...) is a portable way to
    // count truthy rows.
    const allMistakes = await db.mistakeRecord.findMany({
      where: { parentId: id },
    });
    const resolved = allMistakes.filter((m: any) => m.isResolved === 1 || m.isResolved === true).length;

    return NextResponse.json({
      ...user,
      students,
      mistakeStats: {
        total: allMistakes.length,
        resolved,
      },
    });
  } catch (err) {
    console.error('[admin/users/[id] GET] failed:', err);
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    // Only allow email updates for now. passwordHash reset is intentionally
    // not exposed here to avoid foot-guns; that can be a dedicated endpoint.
    const data: Record<string, unknown> = {};
    if (typeof body.email === 'string' && body.email.length > 0) {
      data.email = body.email;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'BAD_REQUEST',
          error: 'No editable fields provided',
        },
        { status: 400 },
      );
    }
    await db.user.update({ where: { id }, data: data as any });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/[id] PATCH] failed:', err);
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // FK ON DELETE CASCADE on student_profiles and mistake_records
    // (declared in lib/db.ts schema) handles the children automatically.
    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/[id] DELETE] failed:', err);
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
