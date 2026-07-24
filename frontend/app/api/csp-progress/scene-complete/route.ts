import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';
import { reevaluateCompletedAt } from '@/lib/server/csp-completion';

// POST /api/csp-progress/scene-complete
// Mark a scene as fully watched. Called by the client when the
// scene's TTS or audio playback fires its natural `onended` event
// (NOT when the user clicks "next" or scrubs — we only credit
// "complete" when the audio actually played to the end).
//
// Body: { classroomId: string, sceneId: string }
// Auth: required (any signed-in user; role check intentionally
// omitted so a future 'teacher preview as student' mode can reuse
// this endpoint without changes).
//
// Completion ("完成打卡") status is no longer derived inline from
// coveragePct — it now requires (a) coverage >= 0.8 AND (b) every
// quiz scene in the classroom has a 100%-correct submission (see
// /lib/server/csp-completion.ts). After we update viewedScenes, we
// call reevaluateCompletedAt to potentially set csp_progress.completedAt
// (latch semantic: never cleared once set).
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

  // Verify classroom exists AND the sceneId is actually a scene
  // in it. We don't want students to "complete" arbitrary scene
  // IDs in the wrong classroom and inflate their coverage. This
  // also gives us the authoritative `totalScenes` count for
  // coveragePct calculation.
  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    return apiError('Classroom not found', 404);
  }
  const scenes = (classroom as any).scenes ?? [];
  const totalScenes = scenes.length;
  if (totalScenes === 0) {
    return apiError('Classroom has no scenes', 422);
  }
  if (!scenes.some((s: any) => s?.id === sceneId)) {
    return apiError('Scene not found in this classroom', 404);
  }

  // Read-modify-write of viewedScenes. We don't have a real
  // transaction in the prisma-compat shim but better-sqlite3
  // is single-writer so race conditions on this single table
  // are bounded. The window is: two heartbeats happening
  // concurrently. Each heartbeat only reads `watchSeconds` so
  // it never conflicts with this scene-complete read of
  // `viewedScenes`.
  const existing = db.cspProgress.findByUserClass(userId, classroomId);
  const viewed: string[] = (() => {
    if (!existing) return [];
    try {
      const arr = JSON.parse(existing.viewedScenes || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();
  if (!viewed.includes(sceneId)) viewed.push(sceneId);
  const coveragePct = totalScenes > 0 ? viewed.length / totalScenes : 0;
  const now = new Date().toISOString();

  // completedAt is no longer written here — it is owned by
  // csp-completion.ts. We pass null so the upsert only touches
  // the progress columns and leaves the (latched) completedAt
  // alone. The reevaluation below will set it if appropriate.
  const row = db.cspProgress.upsertViewedScene({
    userId,
    classroomId,
    sceneId,
    totalScenes,
    viewedScenes: JSON.stringify(viewed),
    coveragePct,
    lastViewedAt: now,
    completedAt: null,
  });

  // Re-evaluate completion with the new view state. This is
  // cheap (one read of progress + one read of submissions + one
  // classroom JSON read that's almost certainly already warm
  // in the page cache from the validation above). It only
  // writes to DB if the criteria are met AND completedAt was
  // not previously set (latch).
  const completion = await reevaluateCompletedAt(userId, classroomId);

  return NextResponse.json({
    ok: true,
    coveragePct: row?.coveragePct ?? coveragePct,
    completedAt: row?.completedAt ?? null,
    viewedScenes: viewed,
    completion,
  });
}
