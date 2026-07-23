'use client';

/**
 * useCspProgress — student progress reporting for the /csp-lecture
 * public surface (and any future re-use of the same SceneRenderer /
 * PlaybackEngine stack).
 *
 * Three jobs, in order of frequency:
 *
 *  1. **Heartbeat** — a 30-second `setInterval` accumulates
 *     `watchSeconds` on the server via POST /api/csp-progress/heartbeat.
 *     We only fire while `document.visibilityState === 'visible'`
 *     and only when a `classroomId` is resolved. We deliberately
 *     keep this lazy: mounting the hook on the login page is a
 *     no-op, mounting it on a classroom page kicks the loop in.
 *
 *  2. **Scene complete** — POST /api/csp-progress/scene-complete
 *     is called by the host (stage.tsx) when a scene's natural
 *     playback has finished (TTS reached the end of the last
 *     speech action, or a quiz was submitted). The hook itself
 *     doesn't decide when this happens; it just exposes the
 *     `reportSceneComplete` function.
 *
 *  3. **Quiz submit** — POST /api/csp-quiz/submit, called by the
 *     QuizView component when it transitions into the "reviewing"
 *     phase. Lives next to the heartbeat because both need
 *     `classroomId` resolution from the same store.
 *
 * Design notes:
 *
 *  - All three endpoints require a signed-in user. We DON'T
 *    short-circuit on `!session` because the host decides what
 *    "unauthenticated" means for its surface (the csp-lecture
 *    page redirects to /auth/login, but the hook stays mounted
 *    until the redirect lands). The server returns 401 in the
 *    rare race window; the client silently swallows it.
 *
 *  - Heartbeat visibility: when the tab is hidden we don't fire
 *    (browsers throttle setInterval anyway, and counting hidden
 *    time as "watched" would inflate the teacher dashboard).
 *
 *  - The interval is started on mount, cleared on unmount, and
 *    re-keyed when `classroomId` changes (so navigating between
 *    classrooms on the same page resets the loop cleanly).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useStageStore } from '@/lib/store';

const HEARTBEAT_INTERVAL_MS = 30_000;

export type ReportQuizPayload = {
  sceneId: string;
  answers: Array<{
    questionId: string;
    choice: string;
    correct: boolean;
    ms: number;
  }>;
  totalQuestions?: number;
};

export type CspProgressReporter = {
  reportSceneComplete: (sceneId: string) => Promise<void>;
  reportQuizSubmit: (payload: ReportQuizPayload) => Promise<void>;
};

async function postJson(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // `keepalive` so a pending request can survive a quick
      // navigation away (heartbeat is the most likely candidate
      // to fire right before the user clicks the next scene).
      keepalive: true,
    });
  } catch {
    // Network error — silent. The dashboard only needs
    // best-effort stats; we don't want a transient blip to
    // throw in the playback hot path.
    return null;
  }
}

export function useCspProgress(): CspProgressReporter {
  // Read classroomId from the stage store, NOT from props. The
  // hook is used by components that don't have direct access to
  // the URL param (QuizView, Stage's nested children), but they
  // all share the same stage store. `stage.id` is the classroomId
  // because the classroom page does
  // `useStageStore.replaceStageSnapshot({ stage, ... })` with
  // `stage.id = classroomId` (see app/classroom/[id]/page.tsx).
  const classroomId = useStageStore((s) => s.stage?.id ?? null);
  // Track the last heartbeat timestamp so we can compute the
  // delta (in seconds) since the previous call. Starts at 0 so
  // the first tick sends the full HEARTBEAT_INTERVAL_MS.
  const lastBeatAtRef = useRef<number>(0);

  const reportSceneComplete = useCallback(
    async (sceneId: string) => {
      if (!classroomId || !sceneId) return;
      await postJson('/api/csp-progress/scene-complete', {
        classroomId,
        sceneId,
      });
    },
    [classroomId],
  );

  const reportQuizSubmit = useCallback(
    async (payload: ReportQuizPayload) => {
      if (!classroomId || !payload.sceneId) return;
      await postJson('/api/csp-quiz/submit', {
        classroomId,
        sceneId: payload.sceneId,
        answers: payload.answers,
        totalQuestions: payload.totalQuestions,
      });
    },
    [classroomId],
  );

  // Heartbeat effect: fire every 30s while the hook is mounted
  // AND the tab is visible. We subscribe to `visibilitychange`
  // so that hiding the tab pauses counting (a teacher would
  // notice inflated watchSeconds immediately if we didn't).
  useEffect(() => {
    if (!classroomId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    // Track which sceneId the heartbeat should attribute to.
    // Re-read from the store on every tick — the student can
    // jump between scenes without unmounting the hook, and we
    // want the "last viewed" field on the dashboard to reflect
    // the most recent scene.
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        // Reset the cursor so the next visible tick sends the
        // full interval delta instead of the time spent hidden.
        lastBeatAtRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const deltaSeconds = lastBeatAtRef.current
        ? Math.max(1, Math.round((now - lastBeatAtRef.current) / 1000))
        : HEARTBEAT_INTERVAL_MS / 1000;
      lastBeatAtRef.current = now;
      const sceneId = useStageStore.getState().currentSceneId;
      if (!sceneId) return;
      // Clamp to the server-side [0, 120] window (we already
      // skip hidden tabs, so 30s ticks should always land in
      // range — this is belt-and-suspenders).
      const delta = Math.max(1, Math.min(120, deltaSeconds));
      void postJson('/api/csp-progress/heartbeat', {
        classroomId,
        sceneId,
        deltaSeconds: delta,
      });
    };

    // Initialise the cursor at "now" — don't fire a 0-second
    // heartbeat on mount. The first real tick is in 30s.
    lastBeatAtRef.current = Date.now();
    intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      // On becoming visible again, reset the cursor so we don't
      // count the hidden interval as watchSeconds.
      if (document.visibilityState === 'visible') {
        lastBeatAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [classroomId]);

  return { reportSceneComplete, reportQuizSubmit };
}
