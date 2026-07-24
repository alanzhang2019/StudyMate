// /lib/server/csp-rate-limit.ts
//
// Simple in-memory sliding-window rate limiter for the
// csp-progress write endpoints. Used to defend against
// scripted POST floods (e.g. a dev-tools user POSTing
// 15 scene-complete calls in 2 seconds to inflate
// coveragePct).
//
// Why in-memory and not SQLite?
//   - The rate-limit decision must be cheap (microseconds).
//     SQLite WAL on a hot path adds milliseconds and would
//     itself become a bottleneck under attack.
//   - State loss on process restart is acceptable: a fresh
//     container just gets a 5-second grace window. An
//     attacker has to time their flood to land within a
//     window of an existing process, which is already
//     not the trivial attack vector this is defending
//     against (the main attack is dev-tools scripting by
//     a single signed-in user).
//
// Limitations / caveats:
//   - **Per-process only.** Next.js may run multiple workers
//     (cluster mode, serverless). Each worker has its own
//     Map. Effective limit is `MAX * workerCount`. For our
//     1-worker single-container deployment this is exact.
//   - No automatic pruning of old keys — the Map grows by
//     (userId, classroomId) pairs. In practice that's
//     bounded by active users × active classrooms, well
//     under 10k. If this becomes an issue, add a periodic
//     sweep of stale keys (not done now to keep the
//     hot path allocation-free).

const WINDOW_MS = 5_000;
const MAX_PER_WINDOW = 3;

// Keyed by `${userId}:${classroomId}`. Value is the list of
// recent successful (not blocked) request timestamps, sorted
// ascending. We prune on every call so the list never grows
// beyond MAX_PER_WINDOW.
const _buckets = new Map<string, number[]>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkSceneCompleteRateLimit(
  userId: string,
  classroomId: string,
): RateLimitResult {
  const key = `${userId}:${classroomId}`;
  const now = Date.now();
  const list = _buckets.get(key);
  if (list) {
    // Prune timestamps outside the window. We mutate in place
    // and then check the size; this keeps the list at most
    // MAX_PER_WINDOW entries long forever.
    let i = 0;
    while (i < list.length && now - list[i] >= WINDOW_MS) i++;
    if (i > 0) list.splice(0, i);
    if (list.length >= MAX_PER_WINDOW) {
      // Compute retryAfter from the oldest still-valid
      // timestamp; that's the earliest moment we'll be back
      // under the cap.
      const oldest = list[0];
      return { ok: false, retryAfterMs: WINDOW_MS - (now - oldest) };
    }
    list.push(now);
    return { ok: true };
  }
  _buckets.set(key, [now]);
  return { ok: true };
}

// Exposed for tests / admin tooling — not used in the hot path.
export function _resetCspRateLimit(): void {
  _buckets.clear();
}
