// Leaderboard aggregation for the public /csp-lecture page.
//
// "Top 10 students by learning activity" — used by the
// /api/csp-progress/leaderboard route. Reads `users` + `csp_progress`
// and returns a sorted, name-masked ranking.
//
// Quality scoring:
//   score = completedClassrooms × 3 + perfectQuizScenes + improvedQuizScenes × 2
// Time and attendance do not add points. Quiz milestones come from the
// append-only submission history.
//
// Two scopes are supported via the `scope` parameter:
//   - 'total'  — all-time cumulative score
//   - 'daily'  — milestones first earned today (server localtime).
//                The API caller picks the scope via `?scope=` so
//                one source of truth can drive both views.
//
// Daily scope counts milestones first earned today. Total scope counts
// persistent course completions and quiz evidence, so a later lower score
// does not erase a previously achieved milestone.
//
// Caching:
//   - 5 minute in-process TTL. Leaderboard is read on every
//     /csp-lecture page load; with a 3-student cohort today the
//     query is fast, but a /refresh storm from a viral link could
//     hammer it. 5min is the standard "rankings look fresh but
//     don't thrash" knob for a product like this. Override via
//     the `LEADERBOARD_TTL_MS` env var if needed.
//   - The cache is keyed by scope so a daily refresh and a total
//     refresh don't invalidate each other.

import { db, getDb } from '@/lib/db';
import { evaluateCompletion } from '@/lib/server/csp-completion';
import { pinyin } from 'pinyin-pro';

const SCORE_WEIGHT_COMPLETION = 3;
const SCORE_WEIGHT_PERFECT_QUIZ = 1;
const SCORE_WEIGHT_IMPROVEMENT = 2;

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type LeaderboardScope = 'total' | 'daily';

export type LeaderboardEntry = {
  /** Public-safe display name, e.g. "张同学" or "学***". */
  displayName: string;
  /** 1-based rank. */
  rank: number;
  completedClassrooms: number;
  perfectQuizScenes: number;
  improvedQuizScenes: number;
  score: number;
};

export type LeaderboardSnapshot = {
  /** Which window this snapshot was computed for. */
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  /** Total student accounts (cumulative, not just active). */
  totalStudents: number;
  /** Total completed-classroom count across all students in this scope. */
  totalCompletions: number;
  totalPerfectQuizScenes: number;
  totalImprovedQuizScenes: number;
  /** Students with at least one earned learning milestone in this scope. */
  milestoneStudents: number;
  /**
   * YYYY-MM-DD (server localtime) for daily scope; for the
   * total scope this is the day the snapshot was computed
   * (i.e. "as of" date).
   */
  dayKey: string;
  /** When this snapshot was computed (ISO string). */
  computedAt: string;
};

const cacheByScope: Partial<Record<LeaderboardScope, { at: number; data: LeaderboardSnapshot }>> = {};

function getTtlMs(): number {
  const raw = process.env.LEADERBOARD_TTL_MS;
  if (!raw) return DEFAULT_TTL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

function maskName(raw: string | null | undefined): string {
  if (!raw) return '匿名同学';
  const trimmed = raw.trim();
  if (!trimmed) return '匿名同学';
  // 1) CJK 中文 / CJK 名字：保留"姓 + 名每个字的拼音首字母"。
  //    例如 "潘泽言" → "潘zy" (pinyin-pro 默认无音调)。这样在
  //    公开排行榜上能识别出是谁，但只暴露姓 + 名首字母，避免
  //    完整的姓+名被爬取用于社会工程。
  //
  //    复姓按 2 字姓处理 (eg "欧阳" → "欧y")，单字名直接取名
  //    字的拼音首字母 (eg "潘泽" → "潘z")。无法拼音的非 CJK
  //    字符保持原样以避免空字符串。
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    // 复姓白名单 (中国常见复姓)。超出此表的 2 字前缀仍按
    // "首字姓 + 名首字母" 处理 — 极小概率误判，但比维护一
    // 个完整复姓表轻得多。
    const compoundSurnames = new Set([
      '欧阳', '司马', '诸葛', '上官', '夏侯', '尉迟', '皇甫',
      '东方', '令狐', '宇文', '长孙', '慕容', '司徒', '司空',
    ]);
    let surname: string;
    let given: string;
    if (
      trimmed.length >= 4 &&
      compoundSurnames.has(trimmed.slice(0, 2))
    ) {
      surname = trimmed.slice(0, 2);
      given = trimmed.slice(2);
    } else if (trimmed.length >= 2) {
      surname = trimmed[0];
      given = trimmed.slice(1);
    } else {
      // 1 字"名" (eg "潘" 没有 given 部分)：退化到原值
      return trimmed;
    }
    // pinyin(字, { pattern: 'first', toneType: 'none' }) 返回
    // 每个字的拼音首字母字符串 (无音调)。我们对 given 段每
    // 个字分别取首字母，拼接成 "zy" 这样的形式。
    const initials = given
      .split('')
      .map((ch) => {
        if (/[\u4e00-\u9fff]/.test(ch)) {
          return pinyin(ch, { pattern: 'first', toneType: 'none' });
        }
        return ch;
      })
      .join('');
    return surname + initials;
  }
  // 2) 拉丁字符，但明显是"姓名/拼音"形态 → 公开展示原文
  //    (产品决策 2026-07-26: "排行榜姓名如果是拼音或者英文，
  //     可以公开展示")。允许的字符集是西方姓名常用符号: 字母、
  //    数字、空格、句点、连字符、撇号、感叹号 (eg "Mary-Jane",
  //    "O'Brien", "李.小龙" 不会到这里因为 CJK 已在上面处理)。
  //    必须以字母开头 (避免纯数字电话号被识别), 长度上限 32
  //    (避免超长随机串被原样暴露)。
  //
  //    不通过这条的: 含 `@` (邮箱)、全数字开头 (电话号)、
  //    含其他符号 (爬虫填充/JS 注入) — 走下面第 3 步脱敏。
  if (
    trimmed.length >= 1 &&
    trimmed.length <= 32 &&
    /^[A-Za-z][A-Za-z0-9 .\-_'!]*$/.test(trimmed)
  ) {
    return trimmed;
  }
  // 3) 兜底: 邮箱/电话/含特殊字符的输入, 走原脱敏 (首字 + *)
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(Math.min(trimmed.length - 1, 5))}`;
}

/**
 * Compute the leaderboard. Results are cached in-process for
 * `LEADERBOARD_TTL_MS` (default 5 min), keyed by scope so a
 * daily refresh and a total refresh don't invalidate each other.
 * The cache is per-server; in a multi-instance deployment each
 * replica caches independently, which is fine — leaderboard is
 * not a strong consistency surface.
 */
export async function getLeaderboard(
  scope: LeaderboardScope = 'total',
): Promise<LeaderboardSnapshot> {
  const ttl = getTtlMs();
  const cached = cacheByScope[scope];
  if (cached && Date.now() - cached.at < ttl) {
    return cached.data;
  }

  const data = await computeLeaderboard(scope);
  cacheByScope[scope] = { at: Date.now(), data };
  return data;
}

/** Bypass the in-process cache (admin / refresh button). */
export function invalidateLeaderboardCache(): void {
  cacheByScope.total = undefined;
  cacheByScope.daily = undefined;
}

async function computeLeaderboard(
  scope: LeaderboardScope,
): Promise<LeaderboardSnapshot> {
  // 1. Pull every student-role user with their progress rows.
  //    We do this in two queries (users, then progress) rather
  //    than a JOIN because the user table is tiny and the
  //    progress table is the hot one — the JOIN would force
  //    better-sqlite3 to materialise the cartesian product
  //    in memory before aggregation. With ~3 students today
  //    it's irrelevant, but the shape is the same at 3000.
  const users = (db as any).user.findMany({
    where: { role: 'student' },
  }) as Array<{ id: string; name: string | null; email: string }>;
  const totalStudents = users.length;
  if (totalStudents === 0) {
    return {
      scope,
      entries: [],
      totalStudents: 0,
      totalCompletions: 0,
      totalPerfectQuizScenes: 0,
      totalImprovedQuizScenes: 0,
      milestoneStudents: 0,
      dayKey: todayKey(),
      computedAt: new Date().toISOString(),
    };
  }

  // 2. Count quality milestones from the append-only quiz history.
  // A scene earns a perfect milestone the first time it reaches 100%;
  // an improvement milestone is recorded when a later attempt exceeds the
  // student's previous best. Daily scope includes only milestones earned today.
  type QuizHistoryRow = {
    userId: string;
    classroomId: string;
    sceneId: string;
    attemptIndex: number;
    score: number;
    activityDay: string;
  };
  const userPlaceholders = users.map(() => '?').join(', ');
  const quizHistory = getDb()
    .prepare(
      `SELECT userId, classroomId, sceneId, attemptIndex, score,
              date(submittedAt, 'localtime') AS activityDay
         FROM csp_quiz_submission_history
        WHERE userId IN (${userPlaceholders})
        ORDER BY userId, classroomId, sceneId, attemptIndex, submittedAt`,
    )
    .all(...users.map((user) => user.id)) as QuizHistoryRow[];
  const perfectByUser = new Map<string, Set<string>>();
  const improvedByUser = new Map<string, Set<string>>();
  const dailyPerfectByUser = new Map<string, Set<string>>();
  const dailyImprovedByUser = new Map<string, Set<string>>();
  let currentSceneKey = '';
  let bestScore = Number.NEGATIVE_INFINITY;
  let hadPerfectScore = false;
  const today = todayKey();
  for (const attempt of quizHistory) {
    const sceneKey = `${attempt.userId}:${attempt.classroomId}:${attempt.sceneId}`;
    if (sceneKey !== currentSceneKey) {
      currentSceneKey = sceneKey;
      bestScore = Number.NEGATIVE_INFINITY;
      hadPerfectScore = false;
    }
    const score = Number(attempt.score);
    if (score >= 100) {
      const set = perfectByUser.get(attempt.userId) ?? new Set<string>();
      set.add(`${attempt.classroomId}:${attempt.sceneId}`);
      perfectByUser.set(attempt.userId, set);
      if (!hadPerfectScore && attempt.activityDay === today) {
        const daily = dailyPerfectByUser.get(attempt.userId) ?? new Set<string>();
        daily.add(`${attempt.classroomId}:${attempt.sceneId}`);
        dailyPerfectByUser.set(attempt.userId, daily);
      }
      hadPerfectScore = true;
    }
    if (bestScore !== Number.NEGATIVE_INFINITY && score > bestScore) {
      const set = improvedByUser.get(attempt.userId) ?? new Set<string>();
      set.add(`${attempt.classroomId}:${attempt.sceneId}`);
      improvedByUser.set(attempt.userId, set);
      if (attempt.activityDay === today) {
        const daily = dailyImprovedByUser.get(attempt.userId) ?? new Set<string>();
        daily.add(`${attempt.classroomId}:${attempt.sceneId}`);
        dailyImprovedByUser.set(attempt.userId, daily);
      }
    }
    if (score > bestScore) bestScore = score;
  }
  if (scope === 'total') {
    // Preserve the milestone for older installations where some quizzes may
    // predate append-only history (but only while the latest recorded score
    // still proves mastery).
    const legacyPerfectRows = getDb()
      .prepare(
        `SELECT userId, classroomId, sceneId
           FROM csp_quiz_submissions
          WHERE totalQuestions > 0 AND correctCount = totalQuestions`,
      )
      .all() as Array<{ userId: string; classroomId: string; sceneId: string }>;
    for (const row of legacyPerfectRows) {
      const set = perfectByUser.get(row.userId) ?? new Set<string>();
      set.add(`${row.classroomId}:${row.sceneId}`);
      perfectByUser.set(row.userId, set);
    }
  }

  // 3. Completed classrooms per user.
  //
  //    For 'total' we use the (expensive) `evaluateCompletion()`
  //    path so the leaderboard agrees with the "已打卡" badge on
  //    /student/home and the teacher-facing /admin/csp-progress
  //    overview — both of those render from evaluateCompletion,
  //    and a student who meets the criteria but whose next
  //    heartbeat hasn't tripped the latch yet should still be
  //    counted as complete here.
  //
  //    For 'daily' we use a SQL-only count of first-time
  //    completions today. The latch is set on the first time
  //    criteria is met (see csp-completion.ts) and never reset,
  //    so a row with `completedAt` set today is by definition a
  //    *new* completion today. We deliberately skip the
  //    evaluateCompletion cost on the daily path so refreshing
  //    the daily tab doesn't re-evaluate every (user, classroom)
  //    pair for users with no new completions.
  const completionsByUser = new Map<string, number>();

  if (scope === 'daily') {
    const todayCompletions = getDb()
      .prepare(
        `SELECT userId, COUNT(*) AS cnt
           FROM csp_progress
          WHERE completedAt IS NOT NULL
            AND date(completedAt, 'localtime') = date('now', 'localtime')
          GROUP BY userId`,
      )
      .all() as Array<{ userId: string; cnt: number }>;
    for (const r of todayCompletions) {
      completionsByUser.set(r.userId, r.cnt);
    }
  } else {
    const allProgress = getDb()
      .prepare(
        'SELECT userId, classroomId FROM csp_progress',
      )
      .all() as Array<{ userId: string; classroomId: string }>;
    await Promise.all(
      allProgress.map(async (p) => {
        const result = await evaluateCompletion(p.userId, p.classroomId);
        if (result.completed) {
          completionsByUser.set(
            p.userId,
            (completionsByUser.get(p.userId) ?? 0) + 1,
          );
        }
      }),
    );
  }

  // 4. Build the candidate set from learning milestones only.
  type Candidate = {
    userId: string;
    displayName: string;
    completedClassrooms: number;
    perfectQuizScenes: number;
    improvedQuizScenes: number;
    score: number;
  };
  const candidates: Candidate[] = [];
  for (const u of users) {
    const completedClassrooms = completionsByUser.get(u.id) ?? 0;
    const perfectQuizScenes =
      (scope === 'daily' ? dailyPerfectByUser : perfectByUser).get(u.id)?.size ?? 0;
    const improvedQuizScenes =
      (scope === 'daily' ? dailyImprovedByUser : improvedByUser).get(u.id)?.size ?? 0;
    if (completedClassrooms === 0 && perfectQuizScenes === 0 && improvedQuizScenes === 0) {
      continue;
    }
    const score =
      completedClassrooms * SCORE_WEIGHT_COMPLETION +
      perfectQuizScenes * SCORE_WEIGHT_PERFECT_QUIZ +
      improvedQuizScenes * SCORE_WEIGHT_IMPROVEMENT;
    candidates.push({
      userId: u.id,
      // Prefer the user-set name. Fall back to the email's
      // local part (e.g. "alice" from "alice@x.com") which
      // is the more familiar display in the absence of a
      // name. Both still go through maskName() for the
      // public response.
      displayName: u.name ?? u.email.split('@')[0] ?? '同学',
      completedClassrooms,
      perfectQuizScenes,
      improvedQuizScenes,
      score,
    });
  }

  // 5. Sort by quality score, then by completion and improvement evidence.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.completedClassrooms !== a.completedClassrooms) {
      return b.completedClassrooms - a.completedClassrooms;
    }
    return b.improvedQuizScenes - a.improvedQuizScenes;
  });

  // 6. Return ALL ranked participants. The earlier top-10 cap
  //    was removed (2026-07-02) so the public page can show
  //    the whole cohort. The UI scrolls the list internally
  //    when the count exceeds a comfortable viewport height.
  //    The mask happens at the response boundary, not here,
  //    so internal callers (admin) can use the real name.
  const entries = candidates.map((c, i) => ({
    rank: i + 1,
    displayName: maskName(c.displayName),
    completedClassrooms: c.completedClassrooms,
    perfectQuizScenes: c.perfectQuizScenes,
    improvedQuizScenes: c.improvedQuizScenes,
    score: c.score,
  }));

  // 7. Cohort summary numbers.
  const totalCompletions = candidates.reduce(
    (s, c) => s + c.completedClassrooms,
    0,
  );
  const totalPerfectQuizScenes = candidates.reduce(
    (sum, candidate) => sum + candidate.perfectQuizScenes,
    0,
  );
  const totalImprovedQuizScenes = candidates.reduce(
    (sum, candidate) => sum + candidate.improvedQuizScenes,
    0,
  );
  const milestoneStudents = candidates.length;

  return {
    scope,
    entries,
    totalStudents,
    totalCompletions,
    totalPerfectQuizScenes,
    totalImprovedQuizScenes,
    milestoneStudents,
    dayKey: todayKey(),
    computedAt: new Date().toISOString(),
  };
}

function todayKey(): string {
  // Server-local YYYY-MM-DD — matches the `date(..., 'localtime')`
  // grouping in the SQL above, so `dayKey` is the same day the
  // activity was attributed to. Built from `getFullYear` /
  // `getMonth` / `getDate` (which read the server's local
  // timezone) rather than `toLocaleDateString('en-CA')` so we
  // don't depend on the runtime having the en-CA locale.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
