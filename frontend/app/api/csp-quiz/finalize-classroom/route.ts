import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';

// POST /api/csp-quiz/finalize-classroom
// V2: aggregate every scene-level submission this user has for the
// given classroom and return one total-score record. Replaces the
// v1 "each scene finalizes independently" simplification that
// displayed only the *last* scene's score on the 交卷 page.
//
// Body: { classroomId: string }
// Auth: required.
//
// Response: {
//   classroomId: string,
//   totalEarned: number,     // sum of all scene correctCount (count
//                            //   of correct answers, not points)
//   totalPossible: number,   // sum of all scene totalQuestions
//   totalPoints: number,     // point-weighted total of correct
//                            //   answers (CSP questions can be
//                            //   worth 1.5 / 2 / etc. points)
//   totalMaxPoints: number,  // point-weighted total of all
//                            //   questions in all scenes — the
//                            //   "满分"
//   totalScore: number,      // 0-100, totalPoints / totalMaxPoints
//   sceneCount: number,      // distinct sceneId rows we aggregated
//   sceneResults: [{
//     sceneId: string,
//     correctCount: number,  // count of correct answers in this scene
//     totalQuestions: number,// count of questions in this scene
//     points: number,        // sum of points for correct answers
//     maxPoints: number,     // sum of points for all questions
//     score: number,         // 0-100, points / maxPoints
//   }]
// }
//
// We deliberately do NOT insert a new row in a "finalized" table —
// the per-scene csp_quiz_submissions table is already the source of
// truth, and adding a second write path would create a sync
// headache (which table wins? what if the user re-answers?). The
// aggregation here is read-only.
//
// Per-question points: we parse each row's `answersJson` (the
// per-question detail saved at submit time, which now includes a
// `points` field). Submissions written before the `points` field
// existed fall back to 1 point per question so the total stays
// consistent.
//
// V3 category aggregation: each Scene in the classroom JSON carries
// a `category` field ('choice' | 'read' | 'perfect') and the
// stage top-level carries a `scoreBreakdown` map
// { choice, read, perfect } that defines the **paper-standard
// 满分** per category (e.g. CSP-J 2024 = 30/24/46 = 100). The
// final total is then `Σ earned(cat) / Σ max(cat)`, and the
// response includes a per-category breakdown so the FinalScorePage
// can render "单选题 24/30 · 阅读 18/24 · 完善 38/46 · 总 80/100".
// When `scoreBreakdown` is missing on the stage, we fall back to
// the per-question `points` sum (the v2 behaviour) so older
// classroom JSONs keep working.
type Category = 'choice' | 'read' | 'perfect';
const CATEGORY_LABEL: Record<Category, string> = {
  choice: '单选题',
  read: '程序阅读题',
  perfect: '完善程序题',
};
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: { classroomId?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId } = body;
  if (!classroomId) {
    return apiError('classroomId is required', 400);
  }

  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    return apiError('Classroom not found', 404);
  }

  // Per-scene aggregation. We pull every submission row this user
  // has for this classroom and bucket by sceneId. Per-scene
  // dedup follows "keep the best (highest-score) submission" —
  // the same rule used by /lib/server/csp-completion.ts:
  //
  //   1. The `csp_quiz_submissions` table is UNIQUE on
  //      (userId, classroomId, sceneId) and UPSERT-overwritten on
  //      re-submit, so in steady state there is AT MOST one row
  //      per (user, scene). The dedup loop below is a defense in
  //      depth — if a code path ever bypasses the upsert and
  //      leaves stale rows behind, we still surface the BEST
  //      attempt to the student, not the oldest.
  //
  //   2. The previous version of this code was
  //      `if (existing && r.updatedAt <= existing.updatedAt) continue;`
  //      but `csp_quiz_submissions` has no `updatedAt` column
  //      (only `submittedAt`), so `r.updatedAt` was always
  //      `undefined` and the guard never fired — meaning a
  //      legacy multi-row scenario would silently fall back to
  //      the OLDEST submittedAt row. That explained the
  //      "重新答题分数没变" user report: re-doing a scene and
  //      re-submitting UPSERTs the latest row (correctly), but
  //      the byScene loop then overwrote it with any stale row
  //      left behind from an earlier code path. Switching to
  //      "highest points wins" matches csp-completion.ts's rule
  //      and matches the user-visible "重做全对就算通过" promise.
  const rows = db.cspQuizSubmission.findByUser(userId, classroomId);
  // Build a sceneId → questions[] lookup from the classroom
  // JSON so we can fill in the per-question `points` for
  // submissions written before that field was persisted in
  // answersJson (legacy data). Also used for the same lookup
  // when answersJson is missing the field on a per-row basis.
  // For a Scene of type "quiz", the questions live at
  // `scene.content.questions` (the SceneContent is a union and
  // QuizContent is the only branch that carries questions).
  const questionsBySceneId = new Map<string, Array<{ id: string; points?: number }>>();
  // sceneId → category, sourced from each scene's `category`
  // field. Scenes without a `category` are ignored when we
  // compute the per-category breakdown (their points still count
  // toward the v2 fallback total if scoreBreakdown is missing).
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
  // stage.scoreBreakdown: paper-standard 满分 per category.
  // Defaults to zeros for any missing key (so the response still
  // has all three rows; they'll just show 0/0 in the UI).
  const rawBreakdown = ((classroom as any).stage?.scoreBreakdown ?? {}) as Record<
    string,
    number
  >;
  const scoreBreakdown: Record<Category, number> = {
    choice: typeof rawBreakdown.choice === 'number' && rawBreakdown.choice > 0 ? rawBreakdown.choice : 0,
    read: typeof rawBreakdown.read === 'number' && rawBreakdown.read > 0 ? rawBreakdown.read : 0,
    perfect: typeof rawBreakdown.perfect === 'number' && rawBreakdown.perfect > 0 ? rawBreakdown.perfect : 0,
  };
  const hasBreakdown =
    scoreBreakdown.choice + scoreBreakdown.read + scoreBreakdown.perfect > 0;
  const lookupPoints = (sceneId: string, questionId: string): number => {
    const sceneQuestions = questionsBySceneId.get(sceneId);
    if (!sceneQuestions) return 1;
    const q = sceneQuestions.find((it) => it.id === questionId);
    if (!q) return 1;
    return typeof q.points === 'number' && Number.isFinite(q.points) && q.points > 0
      ? q.points
      : 1;
  };
  const byScene = new Map<
    string,
    {
      correctCount: number;
      totalQuestions: number;
      points: number;
      maxPoints: number;
      score: number;
      submittedAt: string;
    }
  >();
  for (const r of rows) {
    const existing = byScene.get(r.sceneId);
    // Compute this row's per-scene point totals regardless of
    // whether we'll keep it; we need them to compare against
    // the existing best on a level playing field.
    let perScenePoints = 0;
    let perSceneMaxPoints = 0;
    let perSceneCorrect = 0;
    let perSceneTotal = 0;
    try {
      const parsed = JSON.parse(r.answersJson ?? '[]') as Array<{
        questionId?: string;
        correct?: boolean;
        points?: number;
      }>;
      for (const entry of parsed) {
        const pts =
          typeof entry?.points === 'number' && Number.isFinite(entry.points) && entry.points > 0
            ? entry.points
            : lookupPoints(r.sceneId, entry?.questionId ?? '');
        perSceneMaxPoints += pts;
        perSceneTotal += 1;
        if (entry?.correct === true) {
          perScenePoints += pts;
          perSceneCorrect += 1;
        }
      }
    } catch {
      // Malformed answersJson — fall back to count-based totals
      // using totalQuestions / correctCount. This is the pre-v2
      // behaviour and keeps the page renderable for any
      // accidentally-corrupt row.
      perSceneMaxPoints = r.totalQuestions ?? 0;
      perSceneTotal = r.totalQuestions ?? 0;
      perSceneCorrect = r.correctCount ?? 0;
      perScenePoints = r.correctCount ?? 0;
    }
    // "Latest submittedAt wins" — keep only the most recent
    // submission per sceneId. The csp_quiz_submissions table is
    // UNIQUE on (userId, classroomId, sceneId) and UPSERTed on
    // re-submit, so in steady state there is at most ONE row
    // per (user, scene) and the dedup loop below never skips
    // anything. The previous "highest points wins" variant
    // (`if (existing && perScenePoints <= existing.points)
    // continue;`) was wrong for two reasons:
    //
    //   1. When a student resets a scene (POST /api/csp-quiz/reset
    //      deletes the row) and re-does it worse than before
    //      (e.g. they second-guessed themselves), the *new*
    //      submission is the source of truth — the user expects
    //      "my latest attempt", not "my best ever". Highest-wins
    //      would silently resurrect the prior attempt's higher
    //      score, which the student cannot see and did not earn
    //      in the current session.
    //
    //   2. If a future code path ever bypasses the upsert and
    //      leaves stale duplicate rows behind, latest-wins picks
    //      the most recent one — the one the student last saw —
    //      while highest-wins might resurrect a 2-weeks-old
    //      record that contradicts what the UI just showed.
    //
    // We rely on `findByUser` ordering by `submittedAt DESC`, so
    // the FIRST row we see per sceneId is the latest; later
    // (older) rows for the same sceneId are skipped.
    if (existing) {
      continue;
    }
    byScene.set(r.sceneId, {
      correctCount: perSceneCorrect,
      totalQuestions: perSceneTotal,
      points: perScenePoints,
      maxPoints: perSceneMaxPoints,
      score:
        perSceneMaxPoints > 0
          ? Math.round((perScenePoints / perSceneMaxPoints) * 10000) / 100
          : 0,
      submittedAt: r.submittedAt,
    });
  }

  // sceneId → title, sourced from each scene's `title` field. We
  // also track order so the client can keep scenes in the same
  // order as the classroom JSON when the user has not answered
  // every scene (in which case the byScene map order is
  // submission-driven, not classroom-driven).
  const titleBySceneId = new Map<string, string>();
  const orderBySceneId = new Map<string, number>();
  for (const scene of classroom.scenes ?? []) {
    if (!scene || !scene.id) continue;
    if (typeof scene.title === 'string' && scene.title.trim().length > 0) {
      titleBySceneId.set(scene.id, scene.title);
    }
    if (typeof (scene as any).order === 'number') {
      orderBySceneId.set(scene.id, (scene as any).order as number);
    }
  }
  const sceneResults = Array.from(byScene.entries()).map(([sceneId, v]) => ({
    sceneId,
    title: titleBySceneId.get(sceneId) ?? '',
    order: orderBySceneId.get(sceneId) ?? Number.MAX_SAFE_INTEGER,
    category: categoryBySceneId.get(sceneId) ?? null,
    correctCount: v.correctCount,
    totalQuestions: v.totalQuestions,
    points: v.points,
    maxPoints: v.maxPoints,
    score: v.score,
  }));

  const totalEarned = sceneResults.reduce((s, r) => s + r.correctCount, 0);
  const totalPossible = sceneResults.reduce((s, r) => s + r.totalQuestions, 0);
  const totalPoints = sceneResults.reduce((s, r) => s + r.points, 0);
  const totalMaxPoints = sceneResults.reduce((s, r) => s + r.maxPoints, 0);
  const totalScore =
    totalMaxPoints > 0
      ? Math.round((totalPoints / totalMaxPoints) * 10000) / 100
      : 0;

  // V3 per-category breakdown. When scoreBreakdown is configured
  // (i.e. the classroom JSON declared a paper-standard 满分 per
  // category), the headline total uses the configured denominators
  // (e.g. 100 instead of the per-question sum). Otherwise we still
  // emit a per-category breakdown array — `mode: 'legacy'` so the UI
  // can fall back to per-scene rendering, but the breakdown[] rows are
  // already grouped by category when the classroom scene JSON has the
  // `category` field. This lets the FinalScorePage show "单选题 24/30
  // / 阅读 18/24 / 完善 38/46" with the actual per-question sum as
  // the per-category denominator instead of refusing to group at all.
  const breakdown = (
    ['choice', 'read', 'perfect'] as Category[]
  ).map((cat) => {
    const scenes = sceneResults.filter((r) => r.category === cat);
    const earned = scenes.reduce((s, r) => s + r.points, 0);
    const standardMax = scoreBreakdown[cat];
    const actualMax = scenes.reduce((s, r) => s + r.maxPoints, 0);
    return {
      category: cat,
      label: CATEGORY_LABEL[cat],
      earned,
      max: hasBreakdown ? standardMax : actualMax,
      actualMax,
      sceneCount: scenes.length,
    };
  });
  const totalEarnedV3 = breakdown.reduce((s, b) => s + b.earned, 0);
  const totalMaxV3 = breakdown.reduce(
    (s, b) => s + (hasBreakdown ? b.max : b.actualMax),
    0,
  );
  const totalScoreV3 =
    totalMaxV3 > 0
      ? Math.round((totalEarnedV3 / totalMaxV3) * 10000) / 100
      : 0;

  // ─── Score history (V4) ─────────────────────────────────────────
  // Read every history row for this (user, classroom) and emit
  // two timelines the UI can render:
  //
  //   historyByScene: { [sceneId]: [{
  //     attemptIndex, score, points, maxPoints, correctCount,
  //     totalQuestions, submittedAt
  //   }, ...] }
  //     Oldest first. Drives the "scene 3: 首次 12 → 订正 18" chips
  //     on the per-scene rows in the final score page.
  //
  //   paperHistory: [{
  //     attemptIndex, totalEarned, totalMax, score, submittedAt
  //   }, ...]
  //     Aggregated across all scenes of this paper at each
  //     attemptIndex. A "订正" attempt is only counted if the
  //     student re-did every scene — partial re-dos are tracked
  //     per scene but don't roll up into a complete "paper
  //     attempt N" line.
  //
  // The history table is APPEND-ONLY, so we read it once here
  // and group in memory. If the per-scene sub queries get large
  // (long-running user) we can switch to window functions or
  // push the aggregation to SQL, but for a single user × single
  // classroom this is fine.
  const historyRows = db.cspQuizSubmissionHistory.findByUserClassroom(
    userId,
    classroomId,
  );
  const historyByScene: Record<
    string,
    Array<{
      attemptIndex: number;
      score: number;
      points: number;
      maxPoints: number;
      correctCount: number;
      totalQuestions: number;
      submittedAt: string;
    }>
  > = {};
  for (const h of historyRows) {
    if (!h || !h.sceneId) continue;
    if (!historyByScene[h.sceneId]) historyByScene[h.sceneId] = [];
    historyByScene[h.sceneId].push({
      attemptIndex: h.attemptIndex ?? 1,
      score: typeof h.score === 'number' ? h.score : 0,
      points: typeof h.points === 'number' ? h.points : 0,
      maxPoints: typeof h.maxPoints === 'number' ? h.maxPoints : 0,
      correctCount: typeof h.correctCount === 'number' ? h.correctCount : 0,
      totalQuestions:
        typeof h.totalQuestions === 'number' ? h.totalQuestions : 0,
      submittedAt: h.submittedAt ?? '',
    });
  }
  // Each scene's history is already ASC by submittedAt from the
  // SQL ORDER BY, but be defensive in case a future migration
  // changes the ordering.
  for (const k of Object.keys(historyByScene)) {
    historyByScene[k].sort((a, b) => a.attemptIndex - b.attemptIndex);
  }

  // Roll up to paper-level. An "attempt N" exists for this paper
  // only if every scene the student has ever attempted has at
  // least one history row at index N. In practice that means
  // the student finished every scene N times; we don't try to
  // track partial re-dos at the paper level (UI uses per-scene
  // history for that).
  const maxAttemptIndex = historyRows.reduce(
    (m, h) => Math.max(m, h.attemptIndex ?? 1),
    1,
  );
  const paperHistory: Array<{
    attemptIndex: number;
    totalEarned: number;
    totalMax: number;
    score: number;
    submittedAt: string;
  }> = [];
  for (let i = 1; i <= maxAttemptIndex; i++) {
    let totalEarned = 0;
    let totalMax = 0;
    let latestAt = '';
    // The "i-th attempt" of the paper is the i-th attempt of
    // each scene the student has answered at all. We only roll
    // up if the student has done every answered scene i times —
    // otherwise the user only has a partial redo and the per-
    // scene timeline is the right place to show it.
    const answeredSceneIds = new Set(
      historyRows.map((h: any) => h.sceneId).filter(Boolean),
    );
    let allScenesCovered = true;
    for (const sid of answeredSceneIds) {
      const row = historyByScene[sid]?.find((r) => r.attemptIndex === i);
      if (!row) {
        allScenesCovered = false;
        break;
      }
      totalEarned += row.points;
      totalMax += row.maxPoints;
      if (row.submittedAt > latestAt) latestAt = row.submittedAt;
    }
    if (!allScenesCovered) continue;
    paperHistory.push({
      attemptIndex: i,
      totalEarned,
      totalMax,
      score: totalMax > 0 ? Math.round((totalEarned / totalMax) * 10000) / 100 : 0,
      submittedAt: latestAt,
    });
  }
  void historyRows; // (already used via historyByScene)

  return NextResponse.json({
    classroomId,
    totalEarned,
    totalPossible,
    totalPoints,
    totalMaxPoints,
    totalScore,
    sceneCount: sceneResults.length,
    sceneResults,
    // V3 fields. `mode` is 'standard' when scoreBreakdown is set
    // (headline numbers come from the configured 满分 map),
    // 'legacy' otherwise (headline numbers come from the
    // per-question points sum).
    mode: hasBreakdown ? 'standard' : 'legacy',
    breakdown,
    totalEarnedV3,
    totalMaxV3,
    totalScoreV3,
    // V4 score history. historyByScene keyed by sceneId drives
    // the per-scene "首次 / 订正" chips; paperHistory is the
    // aggregated timeline of full-paper attempts for the headline
    // "第 N 次 X 分" display. When the student has only made
    // one attempt, historyByScene will have 1 row per scene and
    // paperHistory will be [{ attemptIndex: 1, score: X, ...}].
    historyByScene,
    paperHistory,
  });
}
