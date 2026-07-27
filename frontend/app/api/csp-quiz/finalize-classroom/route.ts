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
  for (const scene of classroom.scenes ?? []) {
    if (!scene || !scene.id) continue;
    const content = (scene as any).content;
    if (content && Array.isArray(content.questions)) {
      questionsBySceneId.set(
        scene.id,
        content.questions as Array<{ id: string; points?: number }>,
      );
    }
  }
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

  const sceneResults = Array.from(byScene.entries()).map(([sceneId, v]) => ({
    sceneId,
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

  return NextResponse.json({
    classroomId,
    totalEarned,
    totalPossible,
    totalPoints,
    totalMaxPoints,
    totalScore,
    sceneCount: sceneResults.length,
    sceneResults,
  });
}
