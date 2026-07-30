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
  // has for this classroom and bucket by sceneId, keeping the
  // latest `score` per scene (in case a student re-answered).
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
      updatedAt: string;
    }
  >();
  for (const r of rows) {
    const existing = byScene.get(r.sceneId);
    if (existing && r.updatedAt <= existing.updatedAt) continue;
    // Parse per-question points from answersJson. Each entry is
    // { questionId, choice, correct, ms, points? }. We default
    // missing/non-finite points to the classroom's per-question
    // `points` field (via lookupPoints), and fall back to 1 only
    // if the scene is no longer in the classroom JSON.
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
    byScene.set(r.sceneId, {
      correctCount: perSceneCorrect,
      totalQuestions: perSceneTotal,
      points: perScenePoints,
      maxPoints: perSceneMaxPoints,
      score:
        perSceneMaxPoints > 0
          ? Math.round((perScenePoints / perSceneMaxPoints) * 10000) / 100
          : 0,
      updatedAt: r.updatedAt,
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
  });
}
