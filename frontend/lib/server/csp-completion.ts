// /lib/server/csp-completion.ts
//
// "完成打卡" 判定 — 单一事实来源 (single source of truth)。
//
// 完成条件 (按产品要求, 2026-07-26 与 PM 确认):
//   1. 课件进度 coveragePct >= COMPLETION_PROGRESS_THRESHOLD (>= 0.5;
//      观看过一半的 scene 即视为"看完")
//   2. 每个 quiz 场景都至少提交过一次, 且 correctCount === totalQuestions
//      (每节 quiz 都拿满分; 若整门课没有 quiz 场景则视为自动满足)
//
// 锁存 (latch) 语义:
//   一旦 csp_progress.completedAt 被写入, 永不主动清除。
//   学生重做 quiz 分数下降, 打卡状态保持不变。
//   旧数据 (按"看完 100% 即完成" 写入的 completedAt) 也走锁存, 不会
//   因为新标准下其他条件不满足而消失 — 这是产品上的 "保持已完成" 要求。
//
// 调用方约定:
//   - 写路径 (scene-complete / quiz-submit): 写入后调 reevaluateCompletedAt
//     → 内部用 evaluateCompletion 计算, 若 (latched || (progressMet &&
//     quizzesMet)) 且尚未 set 过, 就 setCompletedAt(now)。已 set 过的不动。
//   - 读路径 (overview / me / /student/home): 只调 evaluateCompletion
//     拿 result.completed 等字段, 不写 DB。读路径的 `completed` 字段是
//     `latched || (progressMet && quizzesMet)`, 所以即使 completedAt
//     还没回填 (旧数据 / 写路径还没跑过), UI 也会正确显示"已打卡"。

import { db } from '@/lib/db';
import { readClassroom } from '@/lib/server/classroom-storage';
import { invalidateLeaderboardCache } from '@/lib/server/leaderboard';

/**
 * 课件进度达成 "完成打卡" 的最低门槛。
 *
 * 覆盖率 = 已观看 scene 数 / 课件总 scene 数。
 *
 * 阈值调整历史:
 *   - 2026-07-24 之前: 1.0（必须看完所有 scene 才能完成）
 *   - 2026-07-24:      0.8（PM 要求"看完 80%"）
 *   - 2026-07-26:      0.5（PM 改为"看完 50%"，本文件改此值即可全局生效）
 *
 * 锁存（latched）语义保证已写过的 completedAt 不会被本阈值的回退
 * 而撤销 — 见文件顶部 "锁存语义" 段落。
 */
export const COMPLETION_PROGRESS_THRESHOLD = 0.5;

export type FailedQuiz = {
  sceneId: string;
  sceneTitle: string;
  /** 学生在该 quiz 上答对了几题。0 = 没提交过。 */
  correct: number;
  /** 该 quiz 一共有几题。0 = quiz 自身数据缺失。 */
  total: number;
  reason: 'no_submission' | 'partial' | 'no_questions';
};

export type CompletionResult = {
  /** 锁存或新标准任一满足, 都视为"已完成打卡"。 */
  completed: boolean;
  /** 持久化层面 completedAt 是否已 set (latch)。 */
  latched: boolean;
  /** 进度维度是否达标 (coveragePct >= COMPLETION_PROGRESS_THRESHOLD
   *  或整门课无场景)。                                 */
  progressMet: boolean;
  /** Quiz 维度是否达标 (每节 quiz 都满分, 或整门课无 quiz)。 */
  quizzesMet: boolean;
  coveragePct: number;
  totalScenes: number;
  viewedCount: number;
  quizScenesCount: number;
  passedQuizCount: number;
  failedQuizScenes: FailedQuiz[];
  /** 简短的中文 hint, 给 UI 直接展示 (eg "还需观看 3 节" / "还有 1 个 quiz 未满分")。 */
  reasons: string[];
};

function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * 计算一名学生在某门课件上的"完成打卡"状态。
 *
 * 不读写 DB, 纯计算 + 查询, 适合读路径 (overview / me / student home) 直接调用。
 */
export async function evaluateCompletion(
  userId: string,
  classroomId: string,
): Promise<CompletionResult> {
  const progress = db.cspProgress.findByUserClass(userId, classroomId);
  const classroom = await readClassroom(classroomId);
  const scenes = classroom?.scenes ?? [];
  const totalScenes = scenes.length;
  const quizScenes = scenes.filter((s) => s?.type === 'quiz');

  const viewed = progress ? safeJsonArray(progress.viewedScenes) : [];
  const viewedCount = viewed.length;
  const coveragePct = totalScenes > 0 ? viewedCount / totalScenes : 0;
  // 整门课没场景 (理论上不该发生, 但兜底) 视为进度自动满足。
  const progressMet =
    totalScenes === 0 ? true : coveragePct >= COMPLETION_PROGRESS_THRESHOLD;

  const submissions = db.cspQuizSubmission.findByUser(userId, classroomId);
  // Re-take semantics: the table is UNIQUE on
  // (userId, classroomId, sceneId) — every successful submit
  // upserts the row, so in steady state there is AT MOST one
  // submission per (user, scene). However, the history
  // `findByUser` query (used here for performance, single
  // index hit) returns the rows in `submittedAt DESC` order;
  // if any older duplicates exist from a code path that bypassed
  // upsert, the map below would silently keep the OLDEST score
  // because Map.set is last-write-wins. We instead keep the
  // LATEST row per scene (first-write-wins, since `findByUser`
  // already sorts newest-first). This matches the user-visible
  // rule: "my latest attempt" is what counts for completion,
  // not "my best ever" — a student who resets and re-does worse
  // should see their new score, not have the prior high
  // silently resurrect.
  const subByScene = new Map<string, any>();
  for (const s of submissions) {
    const sid = (s as any).sceneId as string;
    if (subByScene.has(sid)) continue;
    subByScene.set(sid, s);
  }

  const failedQuizScenes: FailedQuiz[] = [];
  let passedQuizCount = 0;
  for (const qs of quizScenes) {
    const sub = subByScene.get((qs as any).id);
    if (!sub) {
      failedQuizScenes.push({
        sceneId: (qs as any).id,
        sceneTitle: (qs as any).title ?? '(无标题)',
        correct: 0,
        total: 0,
        reason: 'no_submission',
      });
      continue;
    }
    const totalQ = (sub as any).totalQuestions ?? 0;
    const correctC = (sub as any).correctCount ?? 0;
    if (totalQ > 0 && correctC === totalQ) {
      passedQuizCount++;
    } else if (totalQ === 0) {
      // 提交了但 totalQuestions=0, 数据异常, 视作不通过。
      failedQuizScenes.push({
        sceneId: (qs as any).id,
        sceneTitle: (qs as any).title ?? '(无标题)',
        correct: 0,
        total: 0,
        reason: 'no_questions',
      });
    } else {
      failedQuizScenes.push({
        sceneId: (qs as any).id,
        sceneTitle: (qs as any).title ?? '(无标题)',
        correct: correctC,
        total: totalQ,
        reason: 'partial',
      });
    }
  }
  // 整门课没有 quiz 场景 → 视为 quiz 维度自动满足 (产品要求)。
  const quizzesMet = quizScenes.length === 0 ? true : failedQuizScenes.length === 0;

  const latched = !!(progress as any)?.completedAt;
  const completed = latched || (progressMet && quizzesMet);

  const reasons: string[] = [];
  if (!progressMet && totalScenes > 0) {
    // 距离阈值还差几节 (向上取整, 至少 1)。"还差" 的目标以常量为准,
    // 这样以后 PM 改阈值时提示文案自动跟随。
    const target = Math.ceil(totalScenes * COMPLETION_PROGRESS_THRESHOLD);
    const need = Math.max(1, target - viewedCount);
    reasons.push(`还需观看 ${need} 节`);
  }
  if (!quizzesMet) {
    reasons.push(`还有 ${failedQuizScenes.length} 道题未满分`);
  }

  return {
    completed,
    latched,
    progressMet,
    quizzesMet,
    coveragePct,
    totalScenes,
    viewedCount,
    quizScenesCount: quizScenes.length,
    passedQuizCount,
    failedQuizScenes,
    reasons,
  };
}

/**
 * 写路径用: 写完 csp_progress / csp_quiz_submissions 后调一次, 让
 * `completedAt` 在条件首次满足时被回填, 已 set 的不动 (latch)。
 *
 * 返回 evaluateCompletion 的完整结果, 方便调用方 (eg scene-complete 路由)
 * 直接把 result 透传给前端, 节省一次额外调用。
 */
export async function reevaluateCompletedAt(
  userId: string,
  classroomId: string,
): Promise<CompletionResult> {
  const result = await evaluateCompletion(userId, classroomId);
  if (result.completed) {
    const existing = db.cspProgress.findByUserClass(userId, classroomId);
    if (existing && !(existing as any).completedAt) {
      db.cspProgress.setCompletedAt(
        userId,
        classroomId,
        new Date().toISOString(),
      );
    }
  }
  // Bust the leaderboard cache whenever a user's completion
  // status may have flipped. Without this the public leaderboard
  // would keep showing a stale `completedClassrooms: 0` for up
  // to `LEADERBOARD_TTL_MS` (default 5 min) after a student
  // legitimately completed a classroom. The cache is per-process
  // so invalidating on write is cheap and only affects this
  // server's next read.
  if (result.completed) {
    invalidateLeaderboardCache();
  }
  return result;
}
