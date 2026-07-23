import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';

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
  const completedAt = coveragePct >= 1 ? now : existing?.completedAt ?? null;

  const row = db.cspProgress.upsertViewedScene({
    userId,
    classroomId,
    sceneId,
    totalScenes,
    viewedScenes: JSON.stringify(viewed),
    coveragePct,
    lastViewedAt: now,
    completedAt,
  });

  return NextResponse.json({
    ok: true,
    coveragePct: row?.coveragePct ?? coveragePct,
    completedAt: row?.completedAt ?? completedAt,
    viewedScenes: viewed,
  });
}
