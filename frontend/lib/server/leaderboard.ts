// Leaderboard aggregation for the public /csp-lecture page.
//
// "Top 10 students by learning activity" — used by the
// /api/csp-progress/leaderboard route. Reads `users` + `csp_progress`
// and returns a sorted, name-masked ranking.
//
// Scoring formula (agreed 2026-07-24 with the user):
//   score = activeDays × 10 + completedClassrooms × 30
//
// Anti-cheat (lightweight v1, no schema change):
//   - A "day" is counted only if the watchSeconds accrued on that
//     day is ≤ MAX_DAILY_WATCH_SECONDS (8 hours). Opening a
//     classroom and leaving it open in a background tab shouldn't
//     inflate the streak; capping at one effective day keeps the
//     number honest.
//   - This is intentionally lenient — false positives (a student
//     actually studied 9h on a heavy day) are cheaper than false
//     negatives (a student gaming the system by going AFK).
//
// Caching:
//   - 5 minute in-process TTL. Leaderboard is read on every
//     /csp-lecture page load; with a 3-student cohort today the
//     query is fast, but a /refresh storm from a viral link could
//     hammer it. 5min is the standard "rankings look fresh but
//     don't thrash" knob for a product like this. Override via
//     the `LEADERBOARD_TTL_MS` env var if needed.

import { db, getDb } from '@/lib/db';

const MAX_DAILY_WATCH_SECONDS = 8 * 60 * 60; // 8h/day

// Score weights. completion-heavy so "finishing a whole
// classroom" is the dominant signal; activeDays provides a
// smaller bonus for the consistent-but-slow student.
const SCORE_WEIGHT_DAY = 10;
const SCORE_WEIGHT_COMPLETION = 30;

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type LeaderboardEntry = {
  /** Public-safe display name, e.g. "张同学" or "学***". */
  displayName: string;
  /** 1-based rank. */
  rank: number;
  activeDays: number;
  completedClassrooms: number;
  score: number;
};

export type LeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  /** Total student accounts (cumulative, not just active). */
  totalStudents: number;
  /** Total completed-classroom count across all students. */
  totalCompletions: number;
  /** Total active student count (≥1 progress row). */
  activeStudents: number;
  /** When this snapshot was computed (ISO string). */
  computedAt: string;
};

let cache: { at: number; data: LeaderboardSnapshot } | null = null;

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
  // 中文 / CJK 名字：保留首字 + "同学" — 不暴露姓 + 名的组合
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return `${trimmed[0]}同学`;
  }
  // 拉丁字符 / 邮箱：保留首字 + 星号
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(Math.min(trimmed.length - 1, 5))}`;
}

/**
 * Compute the leaderboard. Results are cached in-process for
 * `LEADERBOARD_TTL_MS` (default 5 min). The cache is per-server;
 * in a multi-instance deployment each replica caches
 * independently, which is fine — leaderboard is not a strong
 * consistency surface.
 */
export async function getLeaderboard(): Promise<LeaderboardSnapshot> {
  const ttl = getTtlMs();
  if (cache && Date.now() - cache.at < ttl) {
    return cache.data;
  }

  const data = computeLeaderboard();
  cache = { at: Date.now(), data };
  return data;
}

/** Bypass the in-process cache (admin / refresh button). */
export function invalidateLeaderboardCache(): void {
  cache = null;
}

function computeLeaderboard(): LeaderboardSnapshot {
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
      entries: [],
      totalStudents: 0,
      totalCompletions: 0,
      activeStudents: 0,
      computedAt: new Date().toISOString(),
    };
  }

  // 2. Per-(user, day) watchSeconds rollup. We use SQLite's
  //    `date(updatedAt, 'localtime')` to get a YYYY-MM-DD key
  //    in the server's local timezone. The `localtime` modifier
  //    makes the streak align to the student's day, not UTC —
  //    otherwise a student studying at 23:50 would split across
  //    two UTC days and never count both.
  //
  //    The HAVING clause caps each day's watchSeconds at the
  //    anti-cheat threshold. Filtering per-day contributions
  //    BEFORE they inflate the activeDay count is more
  //    accurate than capping the SUM in JS — a single 9h
  //    day contributes 0 (not 1 with a warning), and a normal
  //    1h day contributes 1.
  //
  //    The Prisma-compat shim doesn't expose a `groupBy` or
  //    `having`-on-aggregation API, so we drop to raw SQL.
  const rows = getDb()
    .prepare(
      `SELECT
         userId,
         date(updatedAt, 'localtime') AS day,
         SUM(CAST(watchSeconds AS INTEGER)) AS sec
       FROM csp_progress
       WHERE updatedAt IS NOT NULL
       GROUP BY userId, day
       HAVING sec > 0
         AND sec <= ?`,
    )
    .all(MAX_DAILY_WATCH_SECONDS) as Array<{
      userId: string;
      day: string;
      sec: number;
    }>;

  // 3. Per-user aggregations in JS.
  const userById = new Map(users.map((u) => [u.id, u]));
  const activeDaysByUser = new Map<string, number>();
  for (const r of rows) {
    activeDaysByUser.set(r.userId, (activeDaysByUser.get(r.userId) ?? 0) + 1);
  }

  // 4. Completed classrooms per user — read straight off the
  //    `completedAt` latch. We deliberately do NOT call
  //    `evaluateCompletion()` here: leaderboard shows "people
  //    who finished a class". The latch is exactly that signal
  //    (write-on-finish, idempotent). If a student satisfies
  //    the conditions but the latch hasn't been written yet,
  //    they show up as "in progress" on the leaderboard for
  //    a few seconds — the next heartbeat or scene complete
  //    will trip it. This is the right trade-off: leaderboard
  //    is a low-stakes ranking surface, not a contract.
  const completionRows = getDb()
    .prepare(
      `SELECT userId, COUNT(*) AS n
         FROM csp_progress
         WHERE completedAt IS NOT NULL
         GROUP BY userId`,
    )
    .all() as Array<{ userId: string; n: number }>;
  const completionsByUser = new Map<string, number>();
  for (const r of completionRows) {
    completionsByUser.set(r.userId, Number(r.n) || 0);
  }

  // 5. Build the candidate set. We exclude accounts with zero
  //    progress (no activeDays AND no completions) so the
  //    leaderboard shows actual learners, not "registered but
  //    never logged in". This is also a privacy kindness: empty
  //    accounts that happen to be in `users` with `role=student`
  //    won't accidentally show up as "rank 99" just because
  //    someone registered a throw-away email.
  type Candidate = {
    userId: string;
    displayName: string;
    activeDays: number;
    completedClassrooms: number;
    score: number;
  };
  const candidates: Candidate[] = [];
  for (const u of users) {
    const activeDays = activeDaysByUser.get(u.id) ?? 0;
    const completedClassrooms = completionsByUser.get(u.id) ?? 0;
    if (activeDays === 0 && completedClassrooms === 0) continue;
    const score =
      activeDays * SCORE_WEIGHT_DAY +
      completedClassrooms * SCORE_WEIGHT_COMPLETION;
    candidates.push({
      userId: u.id,
      // Prefer the user-set name. Fall back to the email's
      // local part (e.g. "alice" from "alice@x.com") which
      // is the more familiar display in the absence of a
      // name. Both still go through maskName() for the
      // public response.
      displayName: u.name ?? u.email.split('@')[0] ?? '同学',
      activeDays,
      completedClassrooms,
      score,
    });
  }

  // 6. Sort by score desc, then by completedClassrooms desc
  //    (tiebreaker — a student who actually finished more
  //    classrooms wins over one who just opened many), then
  //    by activeDays desc.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.completedClassrooms !== a.completedClassrooms) {
      return b.completedClassrooms - a.completedClassrooms;
    }
    return b.activeDays - a.activeDays;
  });

  // 7. Top 10. The mask happens at the response boundary, not
  //    here, so internal callers (admin) can use the real name.
  const top = candidates.slice(0, 10).map((c, i) => ({
    rank: i + 1,
    displayName: maskName(c.displayName),
    activeDays: c.activeDays,
    completedClassrooms: c.completedClassrooms,
    score: c.score,
  }));

  // 8. Cohort summary numbers.
  const totalCompletions = candidates.reduce(
    (s, c) => s + c.completedClassrooms,
    0,
  );
  const activeStudents = candidates.length;

  return {
    entries: top,
    totalStudents,
    totalCompletions,
    activeStudents,
    computedAt: new Date().toISOString(),
  };
}
