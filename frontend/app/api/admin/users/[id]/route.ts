import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  listClassroomSummaries,
  readClassroom,
} from '@/lib/server/classroom-storage';
import { evaluateCompletion } from '@/lib/server/csp-completion';

/**
 * 统计某个用户在某个课件上的"随堂练习完成情况"。
 *
 * 返回:
 *   - totalQuizScenes: 该课件一共多少个 quiz 场景
 *   - attemptedScenes: 学生至少交过 1 次的 quiz 场景数
 *   - fullMarkScenes: 学生交过且 correctCount === totalQuestions 的 quiz 场景数
 *   - totalQuestions: 所有 quiz 场景的总题数 (来自 classroom JSON)
 *   - answeredQuestions: 学生做对或做错过的题数 (去重 questionId)
 *   - lastSubmittedAt: 该课件最近一次 quiz 提交时间
 *
 * 之所以用 "做过" 计数而不是 "做对" 计数, 是因为 1) 学生可能
 * 还没答完; 2) 题目可能没有标准答案 (e.g. 真题卷题目 JSON
 * 没带 hasAnswer), 答了也拿不到 correct; 这种情况下 "已答 X / 共 Y"
 * 更能反映进度.
 */
function buildQuizStats(userId: string, classroomId: string, classroom: any) {
  const quizScenes = (classroom?.scenes ?? []).filter(
    (s: any) => s?.type === 'quiz',
  );
  // 总题数: 把所有 quiz 场景的 question 数加总. 如果题面缺失
  // (e.g. 老 admin 上传的 placeholder), 我们用 0 而不是抛错.
  const totalQuestions = quizScenes.reduce(
    (s: number, qs: any) =>
      s + ((qs?.content?.questions ?? []).length || 0),
    0,
  );

  const submissions = db.cspQuizSubmission.findByUser(userId, classroomId);
  // 按 sceneId 取最高分 (重做全对就算通过, 见 csp-completion.ts 同款语义)
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
  // 答过的题数 (去重 questionId)
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
  const lastSubmittedAt =
    submissions.length > 0 ? submissions[0].submittedAt ?? null : null;

  return {
    totalQuizScenes: quizScenes.length,
    attemptedScenes,
    fullMarkScenes,
    totalQuestions,
    answeredQuestions,
    lastSubmittedAt,
  };
}

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
    // 课件 JSON 缓存, 避免每个课件都 fs.readFile 一次.
    const classroomCache = new Map<string, any>();
    async function getClassroom(cid: string) {
      if (classroomCache.has(cid)) return classroomCache.get(cid);
      const c = await readClassroom(cid);
      classroomCache.set(cid, c);
      return c;
    }

    // 同样用 evaluateCompletion 评估"是否已完成", 跟 /student/home 保持一致.
    // 重要: 用 evaluateCompletion 返回的 coveragePct 替代 csp_progress
    // 表里的 coveragePct, 因为前者是从 viewedScenes 数组重新算的,
    // 后者只在 scene-complete 时更新 —— 只做了 quiz 没看 scene 的学生会
    // 显示 0% 但实际有"已答"的数据. 这里用 re-eval 后的真实值.
    const evaluated = await Promise.all(
      myRows.map(async (r) => {
        const completion = await evaluateCompletion(id, r.classroomId);
        const classroom = await getClassroom(r.classroomId);
        const quiz = buildQuizStats(id, r.classroomId, classroom);
        return { row: r, completion, quiz };
      }),
    );
    const checkinRows = evaluated.map(
      ({ row, completion, quiz }) => ({
        classroomId: row.classroomId,
        title: titleById.get(row.classroomId) ?? row.classroomId,
        // 用 evaluateCompletion 的真实 viewedScenes 比例
        // (0-1), 前端展示时 *100 转成百分比
        coveragePct: Math.round((completion.coveragePct ?? 0) * 1000) / 10,
        quiz,
        watchSeconds: row.watchSeconds,
        lastViewedAt: row.lastViewedAt,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
        completed: completion.completed,
      }),
    );
    // 按更新时间倒序, 最近活动的课件排前面
    checkinRows.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    // 随堂练习聚合: 全课件汇总
    const quizStats = {
      totalScenes: checkinRows.reduce(
        (s, r) => s + (r.quiz.totalQuizScenes ?? 0),
        0,
      ),
      attemptedScenes: checkinRows.reduce(
        (s, r) => s + (r.quiz.attemptedScenes ?? 0),
        0,
      ),
      fullMarkScenes: checkinRows.reduce(
        (s, r) => s + (r.quiz.fullMarkScenes ?? 0),
        0,
      ),
      totalQuestions: checkinRows.reduce(
        (s, r) => s + (r.quiz.totalQuestions ?? 0),
        0,
      ),
      answeredQuestions: checkinRows.reduce(
        (s, r) => s + (r.quiz.answeredQuestions ?? 0),
        0,
      ),
      lastSubmittedAt:
        checkinRows
          .map((r) => r.quiz.lastSubmittedAt)
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null,
    };
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
      quiz: quizStats,
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
