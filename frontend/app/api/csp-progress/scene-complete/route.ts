import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';
import { reevaluateCompletedAt } from '@/lib/server/csp-completion';
import { checkSceneCompleteRateLimit } from '@/lib/server/csp-rate-limit';

// POST /api/csp-progress/scene-complete
// Mark a scene as fully watched. Called by the client when the
// scene's TTS or audio playback fires its natural `onended` event
// (NOT when the user clicks "next" or scrubs — we only credit
// "complete" when the audio actually played to the end).
//
// Body: {
//   classroomId: string,
//   sceneId: string,
//   clientActiveWatchSeconds: number,  // required: seconds the
//     student was on this scene with the tab visible
//   clientAudioDuration?: number,     // optional: actual audio
//     duration in seconds as measured by the client's <audio>
//     element. Used to scale the per-scene min threshold. Capped
//     at 600s server-side to prevent abuse.
// }
// Auth: required (any signed-in user).
//
// Defenses against "fast-click" abuse (方案 C in the punch-in
// design doc):
//
//  1. **Per-scene active watch time**. The client must have been
//     on the scene with the tab visible for at least
//     `min(audioDuration * 0.7, 30s)`. Quiz scenes have a
//     minimum of 0 (the quiz submission itself is the engagement
//     signal). This catches the "音频放后台" attack.
//
//  2. **Rate limit**. 5-second sliding window, max 3 calls per
//     (userId, classroomId). Catches scripted POSTs. Returns 429
//     with a `Retry-After`-style header. See
//     /lib/server/csp-rate-limit.ts.
//
//  3. **Anomaly detection**. If coveragePct jumps > 30% in
//     < 60s we write a `suspicious_jump` entry to
//     csp_progress.auditFlags. This is informational only (we
//     don't block the write — false positives are likely, eg
//     a student who comes back the next day and finishes
//     several scenes at once) but the student home row will
//     show a ⚠ indicator.
//
// "完成打卡" status is set by lib/server/csp-completion.ts after
// every successful scene-complete, based on
// coveragePct >= 0.8 AND every quiz scene 100% correct.
const SUSPICIOUS_COVERAGE_DELTA = 0.3;
const SUSPICIOUS_DELTA_WINDOW_MS = 60_000;
// Maximum audio duration we accept from the client. Anything
// larger is silently clamped to this. Chosen as 10 minutes —
// longer than any single scene's TTS in our content (most are
// 30-180s) but high enough to allow a 2x speed-up to fit.
const MAX_AUDIO_DURATION = 600;
const MIN_ACTIVE_SECONDS = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: {
    classroomId?: string;
    sceneId?: string;
    clientActiveWatchSeconds?: number;
    clientAudioDuration?: number;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, sceneId, clientActiveWatchSeconds, clientAudioDuration } = body;
  if (!classroomId || !sceneId) {
    return apiError('classroomId and sceneId are required', 400);
  }
  if (typeof clientActiveWatchSeconds !== 'number' || !isFinite(clientActiveWatchSeconds)) {
    return apiError('clientActiveWatchSeconds is required and must be a finite number', 400);
  }
  if (clientActiveWatchSeconds < 0) {
    return apiError('clientActiveWatchSeconds must be >= 0', 400);
  }

  // Rate limit check. Done before any DB I/O so the cheap path
  // stays cheap under attack.
  const rl = checkSceneCompleteRateLimit(userId, classroomId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many scene-complete calls; please slow down.', retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Verify classroom exists AND the sceneId is actually a scene
  // in it. We don't want students to "complete" arbitrary scene
  // IDs in the wrong classroom and inflate their coverage.
  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    return apiError('Classroom not found', 404);
  }
  const scenes = (classroom as any).scenes ?? [];
  const totalScenes = scenes.length;
  if (totalScenes === 0) {
    return apiError('Classroom has no scenes', 422);
  }
  const scene = scenes.find((s: any) => s?.id === sceneId);
  if (!scene) {
    return apiError('Scene not found in this classroom', 404);
  }

  // Per-scene min threshold. Quiz scenes are exempt because
  // the quiz submission itself is the engagement proof.
  // Cap the client-reported audio duration to prevent trivial
  // bypass (claiming audio is 99999s long makes the threshold
  // trivial to beat). See MAX_AUDIO_DURATION rationale above.
  const isQuiz = scene.type === 'quiz';
  const cappedAudioDuration =
    typeof clientAudioDuration === 'number' && isFinite(clientAudioDuration) && clientAudioDuration > 0
      ? Math.min(clientAudioDuration, MAX_AUDIO_DURATION)
      : 0;
  const threshold = isQuiz
    ? 0
    : Math.max(MIN_ACTIVE_SECONDS, cappedAudioDuration * 0.7);

  // Upper bound: the client cannot claim more active seconds
  // than the audio length + a small leeway. Otherwise a
  // malicious client could send `clientActiveWatchSeconds: 9999`
  // to short-circuit any "min" check.
  const upperBound = cappedAudioDuration > 0 ? cappedAudioDuration + 2 : MAX_AUDIO_DURATION + 2;
  const clampedActiveSeconds = Math.max(0, Math.min(upperBound, clientActiveWatchSeconds));

  if (clampedActiveSeconds < threshold) {
    return NextResponse.json(
      {
        error: 'Not enough active watch time on this scene',
        threshold,
        reported: clampedActiveSeconds,
      },
      { status: 422 },
    );
  }

  // Read-modify-write of viewedScenes + viewedSceneSeconds.
  // We don't have a real transaction in the prisma-compat shim
  // but better-sqlite3 is single-writer so race conditions on
  // this single table are bounded. The window is: two
  // heartbeats happening concurrently. Each heartbeat only
  // reads `watchSeconds` so it never conflicts with this
  // scene-complete read of `viewedScenes`.
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
  const wasAlreadyViewed = viewed.includes(sceneId);
  if (!wasAlreadyViewed) viewed.push(sceneId);
  const coveragePct = totalScenes > 0 ? viewed.length / totalScenes : 0;
  const now = new Date().toISOString();

  // Merge the per-scene active seconds map. We MAX the new
  // value against any existing one (so a re-take with less
  // active time doesn't *lower* the recorded value — and
  // doesn't invalidate the "completed" latch on a later write).
  const perSceneSeconds: Record<string, number> = (() => {
    if (!existing) return {};
    try {
      const obj = JSON.parse(existing.viewedSceneSeconds || '{}');
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  })();
  const prevSec = Number(perSceneSeconds[sceneId] ?? 0);
  perSceneSeconds[sceneId] = Math.max(prevSec, clampedActiveSeconds);

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
    viewedSceneSeconds: JSON.stringify(perSceneSeconds),
  });

  // Anomaly detection: if coveragePct jumped > 30% in < 60s
  // since the last write to this row, record a `suspicious_jump`
  // audit entry. We skip the check on a no-op upsert
  // (wasAlreadyViewed) — only "new" completions contribute to a
  // jump. Also skip if there's no previous row to compare
  // against (first ever write).
  if (!wasAlreadyViewed && existing) {
    const prevCoverage = Number(existing.coveragePct ?? 0);
    const prevUpdatedAtMs = existing.updatedAt ? Date.parse(existing.updatedAt) : NaN;
    if (isFinite(prevUpdatedAtMs)) {
      const elapsed = Date.now() - prevUpdatedAtMs;
      const delta = coveragePct - prevCoverage;
      if (delta > SUSPICIOUS_COVERAGE_DELTA && elapsed < SUSPICIOUS_DELTA_WINDOW_MS) {
        db.cspProgress.appendAuditFlag(userId, classroomId, {
          kind: 'suspicious_jump',
          at: now,
          details: {
            coverageDelta: Math.round(delta * 1000) / 1000,
            elapsedSec: Math.round(elapsed / 1000),
            sceneId,
          },
        });
      }
    }
  }

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
    recordedActiveSeconds: perSceneSeconds[sceneId],
    threshold,
    completion,
  });
}
