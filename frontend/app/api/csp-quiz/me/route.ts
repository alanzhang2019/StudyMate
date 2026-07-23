import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';

// GET /api/csp-quiz/me?classroomId=xxx
// Returns the current user's quiz submissions for one classroom.
// Each row includes the per-question answers parsed back into an
// array so the client can render "your last attempt" without a
// second fetch.
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
  const rows = db.cspQuizSubmission.findByUser(session.user.id, classroomId);
  return NextResponse.json({
    submissions: rows.map((r) => ({
      id: r.id,
      sceneId: r.sceneId,
      totalQuestions: r.totalQuestions,
      correctCount: r.correctCount,
      score: r.score,
      submittedAt: r.submittedAt,
      answers: (() => {
        try {
          const arr = JSON.parse(r.answersJson || '[]');
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      })(),
    })),
  });
}
