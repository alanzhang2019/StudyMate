import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';

// GET /api/csp-quiz/paper-trend
//
// 返回当前用户在所有 24 套历年真题卷（J 组 12 + S 组 12）上的
// 成绩时间序列，每套卷子一条记录。前端 <PaperScoreTrendChart />
// 组件消费此接口渲染 4 折线趋势图（单项选择 / 阅读程序 / 完善程序
// / 总分）。
//
// 设计要点：
//   1. 只统计 24 套 FULL_PAPER_CLASSROOM_IDS（2014–2025 J/S 全套
//      真题），非真题类 CSP 课件（精讲课件、错题讲解）不在此图。
//   2. 用户没做过的卷子不出现在响应里，前端按"答过才有点"渲染。
//   3. 计分逻辑复用 /api/csp-quiz/finalize-classroom 的 V3 算法：
//      - 优先使用 stage.scoreBreakdown 的 paper-standard 满分；
//      - 缺时退回到 per-question points 求和（legacy 模式）。
//      这样历史导入的旧卷子（无 category / scoreBreakdown）也能
//      渲染，不会出现空数据。
//   4. 一次性按用户所有 quiz submissions 聚合，再按 classroomId
//      去重，N 次 round-trip 缩到 1 次（+ 一次 readClassroom/卷子）。
//
// 响应：
//   {
//     papers: [{
//       classroomId, title, year, group,           // 元信息
//       choice:  { earned, max },                    // 单项选择题
//       read:    { earned, max },                    // 阅读程序题
//       perfect: { earned, max },                    // 完善程序题
//       total:   { earned, max, score },             // 总分（百分制）
//       submittedAt, sceneCount
//     }, ...]
//   }

type Category = 'choice' | 'read' | 'perfect';

const CATEGORY_LABEL: Record<Category, string> = {
  choice: '单项选择题',
  read: '阅读程序题',
  perfect: '完善程序题',
};

// 与 components/scene-renderers/quiz-view.tsx 的
// FULL_PAPER_CLASSROOM_IDS 保持一致；这里复制一份而不是 import 是
// 因为该常量目前是组件内的局部 const（不是 module export），为避
// 免把图表组件拖到 server 引用，单独在这里维护一份 server-side
// 真题白名单。两侧需要同步更新。
const FULL_PAPER_CLASSROOM_IDS = new Set<string>([
  'cm_imp_cspj2014j_v1', 'cm_imp_cspj2015j_v1', 'cm_imp_cspj2016j_v1',
  'cm_imp_cspj2017j_v1', 'cm_imp_cspj2018j_v1', 'cm_imp_cspj2019j_v1',
  'cm_imp_cspj2020j_v1', 'cm_imp_cspj2021j_v1', 'cm_imp_cspj2022j_v1',
  'cm_imp_cspj2023j_v1', 'cm_imp_cspj2024j_v1', 'cm_imp_cspj2025j_v1',
  'cm_imp_csps2014s_v1', 'cm_imp_csps2015s_v1', 'cm_imp_csps2016s_v1',
  'cm_imp_csps2017s_v1', 'cm_imp_csps2018s_v1', 'cm_imp_csps2019s_v1',
  'cm_imp_csps2020s_v1', 'cm_imp_csps2021s_v1', 'cm_imp_csps2022s_v1',
  'cm_imp_csps2023s_v1', 'cm_imp_csps2024s_v1', 'cm_imp_csps2025s_v1',
]);

// 从 classroomId 里抽出年份和组别，例如
//   cm_imp_cspj2014j_v1 -> { year: 2014, group: 'J' }
//   cm_imp_csps2023s_v1 -> { year: 2023, group: 'S' }
// 不匹配则返回 null —— 调用方据此跳过非真题。
function parseYearGroup(
  classroomId: string,
): { year: number; group: 'J' | 'S' } | null {
  const m = classroomId.match(/^cm_imp_csp([js])(\d{4})[js]_v1$/);
  if (!m) return null;
  return {
    year: parseInt(m[2], 10),
    group: m[1] === 'j' ? 'J' : 'S',
  };
}

// 单套卷子的 per-category 聚合。和 finalize-classroom 的 V3 段
// 等价；这里独立实现是因为 finalize-classroom 接收的是 "POST 一
// 个 classroomId"，而 paper-trend 是 "一次扫所有 24 套"，把循环
// 放进 finalize 内部会让那个 endpoint 变重。
async function aggregatePaper(
  userId: string,
  classroomId: string,
): Promise<{
  choice: { earned: number; max: number };
  read: { earned: number; max: number };
  perfect: { earned: number; max: number };
  total: { earned: number; max: number; score: number };
  submittedAt: string;
  sceneCount: number;
} | null> {
  const classroom = await readClassroom(classroomId);
  if (!classroom) return null;

  // questionsBySceneId: sceneId -> [{ id, points? }]
  const questionsBySceneId = new Map<
    string,
    Array<{ id: string; points?: number }>
  >();
  const categoryBySceneId = new Map<string, Category>();
  for (const scene of classroom.scenes ?? []) {
    if (!scene || !scene.id) continue;
    const content = (scene as any).content;
    if (content && Array.isArray(content.questions)) {
      questionsBySceneId.set(
        scene.id,
        content.questions as Array<{ id: string; points?: number }>,
      );
    }
    const cat = (scene as any).category;
    if (cat === 'choice' || cat === 'read' || cat === 'perfect') {
      categoryBySceneId.set(scene.id, cat);
    }
  }

  const rawBreakdown = ((classroom as any).stage?.scoreBreakdown ?? {}) as Record<
    string,
    number
  >;
  const scoreBreakdown: Record<Category, number> = {
    choice:
      typeof rawBreakdown.choice === 'number' && rawBreakdown.choice > 0
        ? rawBreakdown.choice
        : 0,
    read:
      typeof rawBreakdown.read === 'number' && rawBreakdown.read > 0
        ? rawBreakdown.read
        : 0,
    perfect:
      typeof rawBreakdown.perfect === 'number' && rawBreakdown.perfect > 0
        ? rawBreakdown.perfect
        : 0,
  };
  const hasBreakdown =
    scoreBreakdown.choice + scoreBreakdown.read + scoreBreakdown.perfect > 0;

  const lookupPoints = (sceneId: string, questionId: string): number => {
    const qs = questionsBySceneId.get(sceneId);
    if (!qs) return 1;
    const q = qs.find((it) => it.id === questionId);
    if (!q) return 1;
    return typeof q.points === 'number' && q.points > 0 ? q.points : 1;
  };

  // Per-scene "latest wins" dedup。csp_quiz_submissions 是 UNIQUE
  // (userId, classroomId, sceneId) UPSERT 表，按 submittedAt DESC
  // 取第一行即可，与 finalize-classroom 的语义一致。
  const rows = db.cspQuizSubmission.findByUser(userId, classroomId);
  const byScene = new Map<
    string,
    { points: number; maxPoints: number; submittedAt: string }
  >();
  for (const r of rows) {
    if (byScene.has(r.sceneId)) continue; // latest wins
    let pts = 0;
    let max = 0;
    try {
      const parsed = JSON.parse(r.answersJson ?? '[]') as Array<{
        questionId?: string;
        correct?: boolean;
        points?: number;
      }>;
      for (const e of parsed) {
        const p =
          typeof e?.points === 'number' && e.points > 0
            ? e.points
            : lookupPoints(r.sceneId, e?.questionId ?? '');
        max += p;
        if (e?.correct === true) pts += p;
      }
    } catch {
      max = r.totalQuestions ?? 0;
      pts = r.correctCount ?? 0;
    }
    byScene.set(r.sceneId, {
      points: pts,
      maxPoints: max,
      submittedAt: r.submittedAt,
    });
  }

  // Per-category 累加
  const earned: Record<Category, number> = { choice: 0, read: 0, perfect: 0 };
  const max: Record<Category, number> = { choice: 0, read: 0, perfect: 0 };
  let latestAt = '';
  for (const [sceneId, v] of byScene) {
    const cat = categoryBySceneId.get(sceneId);
    if (cat) {
      earned[cat] += v.points;
      max[cat] += v.maxPoints;
    }
    if (v.submittedAt > latestAt) latestAt = v.submittedAt;
  }

  // 满分：优先用 stage.scoreBreakdown 的 paper-standard 值；缺则
  // 用 category-scene 求和（legacy）。两种模式都保证 max > 0 的
  // category 进入总分；max = 0 的 category 在前端以 "—" 显示。
  const catMax = (cat: Category) =>
    hasBreakdown ? scoreBreakdown[cat] : max[cat];

  const totalEarned = earned.choice + earned.read + earned.perfect;
  const totalMax =
    catMax('choice') + catMax('read') + catMax('perfect') || 0;
  const totalScore =
    totalMax > 0 ? Math.round((totalEarned / totalMax) * 10000) / 100 : 0;

  return {
    choice: { earned: earned.choice, max: catMax('choice') },
    read: { earned: earned.read, max: catMax('read') },
    perfect: { earned: earned.perfect, max: catMax('perfect') },
    total: { earned: totalEarned, max: totalMax, score: totalScore },
    submittedAt: latestAt,
    sceneCount: byScene.size,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  const rows = db.cspQuizSubmission.findAllByUser(userId);
  if (rows.length === 0) {
    return NextResponse.json({ papers: [] });
  }

  // Dedup: 同一 (user, classroom) 只聚合一次
  const seenClassroomIds = new Set<string>();
  const classroomIds: string[] = [];
  for (const r of rows) {
    if (!r.classroomId) continue;
    if (seenClassroomIds.has(r.classroomId)) continue;
    seenClassroomIds.add(r.classroomId);
    classroomIds.push(r.classroomId);
  }

  // 只保留 24 套真题
  const paperIds = classroomIds.filter((id) => FULL_PAPER_CLASSROOM_IDS.has(id));
  if (paperIds.length === 0) {
    return NextResponse.json({ papers: [] });
  }

  // 一次性 readClassroom + aggregate（与其他 server 端循环用
  // Promise.all 并行；典型 24 套内 page cache 命中率高）
  const aggregated = await Promise.all(
    paperIds.map(async (id) => {
      const meta = parseYearGroup(id);
      if (!meta) return null;
      const data = await aggregatePaper(userId, id);
      if (!data) return null;
      // 没有任何答题数据时跳过（防御性，正常 UPSERT 后不会发生）
      if (data.sceneCount === 0) return null;
      const classroom = await readClassroom(id);
      const title =
        classroom?.stage?.name ?? classroom?.id ?? id;
      return {
        classroomId: id,
        title,
        year: meta.year,
        group: meta.group,
        choice: data.choice,
        read: data.read,
        perfect: data.perfect,
        total: data.total,
        submittedAt: data.submittedAt,
        sceneCount: data.sceneCount,
        mode: data.total.max > 0 ? 'standard' : 'legacy',
      };
    }),
  );

  const papers = aggregated
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => {
      if (a.group !== b.group) return a.group < b.group ? -1 : 1;
      return a.year - b.year;
    });

  return NextResponse.json({ papers, labels: CATEGORY_LABEL });
}
