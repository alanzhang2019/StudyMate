import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';

// POST /api/csp-quiz/reset
// Reset a student's quiz submission for one scene. Used by the
// "重新答题" button on the CSP final paper total score page
// (spec 2026-07-26-csp-final-paper-submit-design.md).
//
// Body: { classroomId: string, sceneId: string }
// Auth: required.
//
// Effects:
//   1. Delete the csp_quiz_submissions row (UNIQUE on
//      userId+classroomId+sceneId).
//   2. If a csp_progress row exists with completedAt set,
//      clear it — the latched completion should be broken so
//      the student's "已完成" badge accurately reflects "now
//      they have no submission at all". The next time they
//      submit, csp-completion.ts will re-evaluate and re-latch
//      if the new submission meets the 50% criteria.
//
// Idempotent: deleting a non-existent row is a no-op
// (sqlite returns changes=0). Repeated calls are safe.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: { classroomId?: string; sceneId?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, sceneId } = body;
  if (!classroomId || !sceneId) {
    return apiError('classroomId and sceneId are required', 400);
  }

  const deleted = db.cspQuizSubmission.deleteByUserScene(userId, classroomId, sceneId);

  // Only clear completedAt if a csp_progress row exists and was
  // already marked complete. Avoids creating an empty row for
  // students who never even started.
  const progress = db.cspProgress.findByUserClass(userId, classroomId);
  if (progress?.completedAt) {
    db.cspProgress.setCompletedAt(userId, classroomId, null);
  }

  return NextResponse.json({
    ok: true,
    deletedRows: deleted,
    clearedCompletion: Boolean(progress?.completedAt),
  });
}
