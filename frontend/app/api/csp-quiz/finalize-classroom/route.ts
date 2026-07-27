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
//   totalEarned: number,     // sum of all scene correctCount weighted
//                            //   by per-question points if known
//   totalPossible: number,   // sum of all scene totalQuestions
//                            //   (we don't have per-question points
//                            //   server-side; we count questions)
//   sceneCount: number,      // distinct sceneId rows we aggregated
//   sceneResults: [{
//     sceneId: string,
//     correctCount: number,
//     totalQuestions: number,
//     score: number,         // 0-100, rounded
//   }]
// }
//
// We deliberately do NOT insert a new row in a "finalized" table —
// the per-scene csp_quiz_submissions table is already the source of
// truth, and adding a second write path would create a sync
// headache (which table wins? what if the user re-answers?). The
// aggregation here is read-only.
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
  const byScene = new Map<
    string,
    { correctCount: number; totalQuestions: number; score: number; updatedAt: string }
  >();
  for (const r of rows) {
    const existing = byScene.get(r.sceneId);
    if (!existing || r.updatedAt > existing.updatedAt) {
      byScene.set(r.sceneId, {
        correctCount: r.correctCount,
        totalQuestions: r.totalQuestions,
        score: r.score,
        updatedAt: r.updatedAt,
      });
    }
  }

  const sceneResults = Array.from(byScene.entries()).map(([sceneId, v]) => ({
    sceneId,
    correctCount: v.correctCount,
    totalQuestions: v.totalQuestions,
    score: v.score,
  }));

  const totalEarned = sceneResults.reduce((s, r) => s + r.correctCount, 0);
  const totalPossible = sceneResults.reduce((s, r) => s + r.totalQuestions, 0);
  const totalScore =
    totalPossible > 0
      ? Math.round((totalEarned / totalPossible) * 10000) / 100
      : 0;

  return NextResponse.json({
    classroomId,
    totalEarned,
    totalPossible,
    totalScore,
    sceneCount: sceneResults.length,
    sceneResults,
  });
}
