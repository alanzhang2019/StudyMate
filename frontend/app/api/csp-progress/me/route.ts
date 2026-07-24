import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { evaluateCompletion } from '@/lib/server/csp-completion';

// GET /api/csp-progress/me?classroomId=xxx
// Returns the current user's progress on a single classroom,
// plus the full "完成打卡" completion detail (progressMet /
// quizzesMet / failedQuizScenes / reasons / etc.) so the
// classroom page can show "you still need to watch 2 scenes
// and 1 quiz to punch in" without a second round-trip.
//
// `completed` reflects the latch-aware semantic: true if
// csp_progress.completedAt is set OR (coveragePct >= 0.8 AND
// every quiz is 100%). See /lib/server/csp-completion.ts.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get('classroomId');
  if (!classroomId) {
    return apiError('classroomId query param is required', 400);
  }

  const row = db.cspProgress.findByUserClass(session.user.id, classroomId);
  const completion = await evaluateCompletion(session.user.id, classroomId);

  if (!row) {
    return NextResponse.json({
      classroomId,
      ...completion,
      watchSeconds: 0,
      viewedScenes: [],
      totalScenes: completion.totalScenes,
      lastViewedSceneId: null,
      lastViewedAt: null,
      completedAt: null,
      inProgress: false,
    });
  }

  return NextResponse.json({
    classroomId,
    totalScenes: row.totalScenes,
    viewedScenes: (() => {
      try {
        const arr = JSON.parse(row.viewedScenes || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    })(),
    watchSeconds: row.watchSeconds,
    coveragePct: row.coveragePct,
    completed: completion.completed,
    latched: completion.latched,
    progressMet: completion.progressMet,
    quizzesMet: completion.quizzesMet,
    quizScenesCount: completion.quizScenesCount,
    passedQuizCount: completion.passedQuizCount,
    failedQuizScenes: completion.failedQuizScenes,
    reasons: completion.reasons,
    inProgress: !completion.completed && completion.viewedCount > 0,
    lastViewedSceneId: row.lastViewedSceneId,
    lastViewedAt: row.lastViewedAt,
    completedAt: row.completedAt,
  });
}
