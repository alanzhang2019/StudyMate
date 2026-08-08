import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateCompletion } from '@/lib/server/csp-completion';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const withCheckin = url.searchParams.get('with') === 'checkin';

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        // 必须传 `studentProfiles`，因为 lib/db.ts PrismaCompatClient
        // 的 user.findMany 只识别 `_count.select.studentProfiles`，
        // 然后把结果改写为 `{ _count: { profiles: <n> } }` 暴露
        // 给调用方。用 `profiles` 会让 _count 变 undefined，
        // 触发 `u._count.profiles` 的 TypeError 把整页崩掉。
        _count: {
          select: { studentProfiles: true },
        },
      },
    });

    if (!withCheckin) {
      return NextResponse.json(users);
    }

    // 注入打卡聚合: 与 /admin/csp-progress 共享同一份定义, 保持一致.
    // 用 evaluateCompletion (而不是只读 completedAt) 避免"已完成但 latch
    // 未写"窗口期跟 /student/home 显示不一致.
    const progressRows = db.cspProgress.findAll() as Array<{
      userId: string;
      classroomId: string;
      watchSeconds: number;
      updatedAt: string;
      completedAt: string | null;
    }>;

    // 按 userId 分桶, 减少 evaluateCompletion 调用次数
    const byUser = new Map<string, typeof progressRows>();
    for (const r of progressRows) {
      const arr = byUser.get(r.userId);
      if (arr) arr.push(r);
      else byUser.set(r.userId, [r]);
    }

    const decorated = await Promise.all(
      users.map(async (u: any) => {
        const rows = byUser.get(u.id) ?? [];
        if (rows.length === 0) {
          return {
            ...u,
            checkin: {
              total: 0,
              completed: 0,
              inProgress: 0,
              totalWatchSeconds: 0,
              lastActiveAt: null,
            },
          };
        }
        const evaluated = await Promise.all(
          rows.map((r) =>
            evaluateCompletion(u.id, r.classroomId).then((c) => ({
              row: r,
              completed: c.completed,
            })),
          ),
        );
        let completed = 0;
        let inProgress = 0;
        let totalWatchSeconds = 0;
        let lastActiveAt: string | null = null;
        let lastTs = -1;
        for (const { row, completed: cCompleted } of evaluated) {
          if (cCompleted) completed++;
          else inProgress++;
          totalWatchSeconds += Number(row.watchSeconds) || 0;
          const ts = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
          if (ts > lastTs) {
            lastTs = ts;
            lastActiveAt = row.updatedAt ?? null;
          }
        }
        return {
          ...u,
          checkin: {
            total: rows.length,
            completed,
            inProgress,
            totalWatchSeconds,
            lastActiveAt,
          },
        };
      }),
    );
    return NextResponse.json(decorated);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
