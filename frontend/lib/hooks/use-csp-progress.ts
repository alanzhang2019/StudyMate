'use client';

/**
 * useCspProgress — student progress reporting for the /csp-lecture
 * public surface (and any future re-use of the same SceneRenderer /
 * PlaybackEngine stack).
 *
 * Four jobs, in order of frequency:
 *
 *  1. **Active watch time tracking** — a `setInterval` running
 *     every 250ms accumulates `activeSeconds[currentSceneId]`
 *     while `document.visibilityState === 'visible'`. The
 *     counter resets when the scene changes. This is the
 *     primary defense against "fast-click" abuse: the server
 *     only credits a `scene-complete` if the client reports
 *     at least `max(30, audioDuration * 0.7)` active seconds
 *     (per /api/csp-progress/scene-complete).
 *
 *  2. **Heartbeat** — a 30-second `setInterval` accumulates
 *     `watchSeconds` on the server via POST /api/csp-progress/heartbeat.
 *     We only fire while `document.visibilityState === 'visible'`.
 *
 *  3. **Scene complete** — POST /api/csp-progress/scene-complete
 *     is called by the host (stage.tsx) when a scene's natural
 *     playback has finished. The hook now also sends
 *     `clientActiveWatchSeconds` and `clientAudioDuration`.
 *     The server may return 422 (under threshold) or 429
 *     (rate-limited); the hook surfaces a console warning but
 *     does not throw — the playback hot path must not break.
 *
 *  4. **Quiz submit** — POST /api/csp-quiz/submit, called by the
 *     QuizView component when it transitions into the "reviewing"
 *     phase.
 *
 * Design notes:
 *
 *  - The active-seconds counter is in a `useRef` (not state)
 *    because mutating it 4×/sec would otherwise cause a render
 *    storm. Reads of the ref always see the current value.
 *
 *  - We key the counter map by `sceneId` (not the scene order
 *    or index) because that's what the server-side
 *    `csp_progress.viewedSceneSeconds` is keyed by. Stable across
 *    reorders.
 *
 *  - The counter increments at 1 second per second of wall-clock
 *    while the tab is visible. We do NOT additionally check
 *    "is the audio paused" because the TTS engine pauses
 *    automatically when the tab is hidden (Chrome's autoplay
 *    policy) — so "visible + on this scene" is a strict-enough
 *    proxy. (The audio element's `paused` state during a manual
 *    pause does NOT need to subtract from the counter: a student
 *    reading the slide while audio is paused is still engaged.)
 */

import { useCallback, useEffect, useRef } from 'react';
import { useStageStore } from '@/lib/store';

const HEARTBEAT_INTERVAL_MS = 30_000;
const ACTIVE_TICK_MS = 250;

export type ReportQuizPayload = {
  sceneId: string;
  answers: Array<{
    questionId: string;
    choice: string;
    correct: boolean;
    ms: number;
    /**
     * Per-question point value, taken from the classroom's
     * `QuizQuestion.points` field (default 1). Sent alongside the
     * answer so the server can compute a point-weighted total
     * (CSP paper has questions worth 1.5 / 2 / etc. points, not
     * always 1). Old submissions without this field are treated
     * as 1 point per question on the server side.
     */
    points?: number;
  }>;
  totalQuestions?: number;
};

export type SceneCompleteResult = {
  ok: boolean;
  // Set when the server rejected the write because the active
  // watch time was below the per-scene min. The caller can
  // surface a UI hint ("请保持页面在前台并听完这一节") without
  // crashing the playback hot path.
  rejected?: 'insufficient_watch_time' | 'rate_limited';
  retryAfterMs?: number;
  threshold?: number;
  reported?: number;
};

export type CspProgressReporter = {
  reportSceneComplete: (sceneId: string) => Promise<SceneCompleteResult>;
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

// Try to read the duration of any <audio> element currently
// in the DOM. Returns 0 if none / not yet loaded. The TTS
// engine attaches its <audio> to document.body so a global
// querySelector suffices. We pick the LAST audio element
// because the most recently-attached one is the active scene
// (the engine replaces the src on scene change).
function readActiveAudioDuration(): number {
  if (typeof document === 'undefined') return 0;
  const audios = document.querySelectorAll('audio');
  for (let i = audios.length - 1; i >= 0; i--) {
    const d = audios[i]?.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return d;
  }
  return 0;
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

  // Per-scene active-seconds map. Stored in a ref to avoid
  // re-renders on every tick. Keyed by sceneId. We never delete
  // entries during a session — the map is small (one entry per
  // scene the student has ever visited) and entries just grow
  // monotonically until page unload.
  const activeSecondsRef = useRef<Map<string, number>>(new Map());
  // Last observed currentSceneId. We compare on every tick to
  // detect scene changes (the active counter only counts time
  // for the *current* scene).
  const lastSceneIdRef = useRef<string | null>(null);
  // Wall-clock timestamp of the most recent active tick. Used
  // to compute the per-tick delta (handles the case where the
  // 250ms timer drifts to 600ms under load).
  const lastTickAtRef = useRef<number>(0);

  const reportSceneComplete = useCallback(
    async (sceneId: string): Promise<SceneCompleteResult> => {
      if (!classroomId || !sceneId) {
        return { ok: false };
      }
      // Snapshot the current active seconds and audio duration
      // *before* any async work. The counter continues running
      // but the value we send is "up to this point", which
      // matches the server's expectation (it's a credit for
      // "the time spent on this scene when the audio ended").
      const activeSeconds = activeSecondsRef.current.get(sceneId) ?? 0;
      const audioDuration = readActiveAudioDuration();
      const res = await postJson('/api/csp-progress/scene-complete', {
        classroomId,
        sceneId,
        clientActiveWatchSeconds: Math.round(activeSeconds * 10) / 10,
        clientAudioDuration: Math.round(audioDuration * 10) / 10,
      });
      if (!res) {
        return { ok: false };
      }
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          rejected: 'insufficient_watch_time',
          threshold: data?.threshold,
          reported: data?.reported,
        };
      }
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          rejected: 'rate_limited',
          retryAfterMs: data?.retryAfterMs,
        };
      }
      return { ok: res.ok };
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

  // Active-seconds tracker effect: ticks every ACTIVE_TICK_MS.
  // While the tab is visible AND the current scene hasn't
  // changed since the last tick, accumulate into the map.
  useEffect(() => {
    if (!classroomId) return;
    lastTickAtRef.current = Date.now();

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        // Don't count hidden-tab time. Reset the wall-clock
        // cursor so the next visible tick starts from "now"
        // and doesn't include the hidden interval.
        lastTickAtRef.current = Date.now();
        return;
      }
      const currentSceneId = useStageStore.getState().currentSceneId;
      if (!currentSceneId) {
        lastTickAtRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const deltaSec = (now - lastTickAtRef.current) / 1000;
      lastTickAtRef.current = now;
      // Scene change? Don't carry over the previous scene's
      // pending delta into the new scene. (We *do* keep the
      // previous scene's accumulated value in the map — that's
      // the server's record. Only the in-flight delta is
      // discarded.)
      if (lastSceneIdRef.current !== currentSceneId) {
        lastSceneIdRef.current = currentSceneId;
        return;
      }
      const prev = activeSecondsRef.current.get(currentSceneId) ?? 0;
      activeSecondsRef.current.set(currentSceneId, prev + deltaSec);
    }, ACTIVE_TICK_MS);

    // Reset the cursor on becoming visible again, so the
    // hidden interval doesn't get counted.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTickAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [classroomId]);

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
