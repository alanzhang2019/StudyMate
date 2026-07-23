import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';

// GET /api/csp-progress/me?classroomId=xxx
// Returns the current user's progress on a single classroom, plus
// a synthetic `inProgress: boolean` (true if coveragePct is
// strictly between 0 and 1) so the client doesn't have to redo
// the comparison.
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
  if (!row) {
    return NextResponse.json({
      classroomId,
      coveragePct: 0,
      watchSeconds: 0,
      viewedScenes: [],
      totalScenes: 0,
      completed: false,
      inProgress: false,
      lastViewedSceneId: null,
      lastViewedAt: null,
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
    completed: !!row.completedAt,
    inProgress: row.coveragePct > 0 && row.coveragePct < 1,
    lastViewedSceneId: row.lastViewedSceneId,
    lastViewedAt: row.lastViewedAt,
    completedAt: row.completedAt,
  });
}
