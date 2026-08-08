import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { listClassroomSummaries } from '@/lib/server/classroom-storage';
import { evaluateCompletion } from '@/lib/server/csp-completion';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, errorCode: 'NOT_FOUND', error: '用户不存在' },
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

    // 打卡数据: 该用户自己的 csp_progress 行 (与 /admin/csp-progress 共享同一份定义).
    // 注意 csp_progress.userId 既可以是学生账号, 也可以是家长账号 (parent 子账号),
    // 这里直接用 user.id 查, 与 student 子账号共享同一份数据.
    const progressRows = db.cspProgress.findAll() as Array<{
      userId: string;
      classroomId: string;
      coveragePct: number;
      watchSeconds: number;
      lastViewedAt: string | null;
      completedAt: string | null;
      updatedAt: string;
    }>;
    const myRows = progressRows.filter((r) => r.userId === id);
    const summaries = await listClassroomSummaries('csp-lecture');
    const titleById = new Map(summaries.map((s) => [s.id, s.title]));

    // 同样用 evaluateCompletion 评估"是否已完成", 跟 /student/home 保持一致.
    const evaluated = await Promise.all(
      myRows.map(async (r) => {
        const completion = await evaluateCompletion(id, r.classroomId);
        return { row: r, completion };
      }),
    );
    const checkinRows = evaluated.map(({ row, completion }) => ({
      classroomId: row.classroomId,
      title: titleById.get(row.classroomId) ?? row.classroomId,
      coveragePct: row.coveragePct,
      watchSeconds: row.watchSeconds,
      lastViewedAt: row.lastViewedAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
      completed: completion.completed,
    }));
    // 按更新时间倒序, 最近活动的课件排前面
    checkinRows.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    const checkinStats = {
      total: checkinRows.length,
      completed: checkinRows.filter((r) => r.completed).length,
      inProgress: checkinRows.filter((r) => !r.completed).length,
      totalWatchSeconds: checkinRows.reduce(
        (s, r) => s + (Number(r.watchSeconds) || 0),
        0,
      ),
      lastActiveAt:
        checkinRows.length > 0 ? checkinRows[0].updatedAt : null,
    };

    return NextResponse.json({
      ...user,
      students,
      mistakeStats: {
        total: allMistakes.length,
        resolved,
      },
      checkin: {
        stats: checkinStats,
        rows: checkinRows,
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
    // PATCH 允许修改: 邮箱 / 姓名 / 重置密码
    // passwordHash 字段从不直接接受明文, 接受 { password: "xxx" } 后用 bcrypt 哈希.
    const data: Record<string, unknown> = {};
    if (typeof body.email === 'string' && body.email.length > 0) {
      data.email = body.email;
    }
    if (typeof body.name === 'string') {
      // 姓名允许清空 (传空字符串 → null), 但不允许纯空白
      data.name = body.name.trim() === '' ? null : body.name.trim();
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'BAD_REQUEST',
            error: '新密码至少 6 位',
          },
          { status: 400 },
        );
      }
      // 与 /api/auth/register 保持一致: bcryptjs cost=10
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'BAD_REQUEST',
          error: '未提供需要修改的字段',
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
