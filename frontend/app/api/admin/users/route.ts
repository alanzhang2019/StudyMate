import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateCompletion } from '@/lib/server/csp-completion';
import { readClassroom } from '@/lib/server/classroom-storage';
import { withAdminAuth } from '@/lib/admin/with-auth';

/**
 * 随堂练习完成情况聚合, 单课件级别. 计算逻辑与
 * /api/admin/users/[id] 的 buildQuizStats 保持一致.
 */
function buildQuizStats(userId: string, classroomId: string, classroom: any) {
  const quizScenes = (classroom?.scenes ?? []).filter(
    (s: any) => s?.type === 'quiz',
  );
  const totalQuestions = quizScenes.reduce(
    (s: number, qs: any) =>
      s + ((qs?.content?.questions ?? []).length || 0),
    0,
  );
  const submissions = db.cspQuizSubmission.findByUser(userId, classroomId);
  const subByScene = new Map<string, any>();
  for (const s of submissions) {
    const sid = (s as any).sceneId as string;
    const prev = subByScene.get(sid);
    if (!prev || ((s as any).score ?? 0) > (prev.score ?? 0)) {
      subByScene.set(sid, s);
    }
  }
  const attemptedScenes = subByScene.size;
  const fullMarkScenes = Array.from(subByScene.values()).filter(
    (s: any) =>
      (s.totalQuestions ?? 0) > 0 &&
      (s.correctCount ?? 0) === (s.totalQuestions ?? 0),
  ).length;
  const answeredQuestions = (() => {
    const set = new Set<string>();
    for (const s of submissions) {
      try {
        const arr = JSON.parse(s.answersJson ?? '[]');
        if (Array.isArray(arr)) {
          for (const e of arr) {
            if (e?.questionId) set.add(String(e.questionId));
          }
        }
      } catch {
        /* ignore */
      }
    }
    return set.size;
  })();
  return {
    totalQuizScenes: quizScenes.length,
    attemptedScenes,
    fullMarkScenes,
    totalQuestions,
    answeredQuestions,
    lastSubmittedAt:
      submissions.length > 0 ? submissions[0].submittedAt ?? null : null,
  };
}

export const GET = withAdminAuth(async (req: NextRequest) => {
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

    // 课件 JSON 缓存, 跨用户复用, 避免每次 list 都重读文件.
    const classroomCache = new Map<string, any>();
    async function getClassroom(cid: string) {
      if (classroomCache.has(cid)) return classroomCache.get(cid);
      const c = await readClassroom(cid);
      classroomCache.set(cid, c);
      return c;
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
              quiz: {
                totalScenes: 0,
                attemptedScenes: 0,
                fullMarkScenes: 0,
                totalQuestions: 0,
                answeredQuestions: 0,
                lastSubmittedAt: null,
              },
            },
          };
        }
        const evaluated = await Promise.all(
          rows.map(async (r) => {
            const completion = await evaluateCompletion(u.id, r.classroomId);
            const classroom = await getClassroom(r.classroomId);
            const quiz = buildQuizStats(u.id, r.classroomId, classroom);
            return { row: r, completed: completion.completed, quiz };
          }),
        );
        let completed = 0;
        let inProgress = 0;
        let totalWatchSeconds = 0;
        let lastActiveAt: string | null = null;
        let lastTs = -1;
        // 随堂练习聚合 (全课件)
        let qTotalScenes = 0;
        let qAttempted = 0;
        let qFullMark = 0;
        let qTotalQ = 0;
        let qAnsweredQ = 0;
        let qLastSubmitted: string | null = null;
        for (const {
          row,
          completed: cCompleted,
          quiz,
        } of evaluated) {
          if (cCompleted) completed++;
          else inProgress++;
          totalWatchSeconds += Number(row.watchSeconds) || 0;
          const ts = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
          if (ts > lastTs) {
            lastTs = ts;
            lastActiveAt = row.updatedAt ?? null;
          }
          qTotalScenes += quiz.totalQuizScenes ?? 0;
          qAttempted += quiz.attemptedScenes ?? 0;
          qFullMark += quiz.fullMarkScenes ?? 0;
          qTotalQ += quiz.totalQuestions ?? 0;
          qAnsweredQ += quiz.answeredQuestions ?? 0;
          if (quiz.lastSubmittedAt) {
            if (qLastSubmitted === null || quiz.lastSubmittedAt > qLastSubmitted) {
              qLastSubmitted = quiz.lastSubmittedAt;
            }
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
            quiz: {
              totalScenes: qTotalScenes,
              attemptedScenes: qAttempted,
              fullMarkScenes: qFullMark,
              totalQuestions: qTotalQ,
              answeredQuestions: qAnsweredQ,
              lastSubmittedAt: qLastSubmitted,
            },
          },
        };
      }),
    );
    return NextResponse.json(decorated);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
});
