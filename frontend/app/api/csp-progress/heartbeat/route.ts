import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';

// POST /api/csp-progress/heartbeat
// Accumulate `watchSeconds` for a user's progress on a classroom.
// The client should send a heartbeat roughly every 30 seconds with
// the number of seconds since the last heartbeat (typically 30).
//
// Body: { classroomId: string, sceneId: string, deltaSeconds: number }
// Auth: required.
//
// Design note: heartbeats are extremely high-frequency (one per
// 30s per active student). They go through the same `cspProgress`
// composite-key model as scene-complete; we use a focused SQL UPDATE
// (`MAX(0, watchSeconds + ?)`) to avoid the read-modify-write
// cost of scene-complete. No classroom-scene validation here — we
// trust the client for which scene is "active" because we only
// need a wall-clock number for watchSeconds, not scene attribution
// (the scene-completion event is what credits the scene, not the
// heartbeat).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: { classroomId?: string; sceneId?: string; deltaSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, sceneId, deltaSeconds } = body;
  if (!classroomId || !sceneId || typeof deltaSeconds !== 'number') {
    return apiError('classroomId, sceneId, and deltaSeconds are required', 400);
  }
  // Sanity: clamp delta to [0, 120s] so a misbehaving client
  // (paused tab, devtools sleep, or a malicious request) can't
  // inflate watchSeconds arbitrarily in a single request. 120s
  // is the upper bound for "the client forgot to send for 4
  // minutes but the tab was actually playing".
  const delta = Math.max(0, Math.min(120, Math.round(deltaSeconds)));

  // Ensure the row exists before we update it. If the student
  // starts watching without ever triggering a scene-complete
  // (e.g. the first scene's TTS hasn't ended yet but 30s of
  // watching has passed), we still need a row to accumulate
  // watchSeconds into. We seed it with 0 coverage here and let
  // the first scene-complete call fill in the real coverage.
  const existing = db.cspProgress.findByUserClass(userId, classroomId);
  if (!existing) {
    // Get totalScenes from the classroom so coverage math
    // stays consistent if a scene-complete fires later.
    let totalScenes = 0;
    try {
      const classroom = await readClassroom(classroomId);
      totalScenes = (classroom as any)?.scenes?.length ?? 0;
    } catch {
      // classroom missing is fine; the scene-complete call
      // will validate again and fail with 404 if it's wrong.
    }
    db.cspProgress.upsertViewedScene({
      userId,
      classroomId,
      sceneId,
      totalScenes,
      viewedScenes: '[]',
      coveragePct: 0,
      lastViewedAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  const row = db.cspProgress.addWatchSeconds(userId, classroomId, delta);
  return NextResponse.json({
    ok: true,
    watchSeconds: row?.watchSeconds ?? 0,
  });
}
