/**
 * Debug event sender for local development.
 * Only sends events when running on localhost (not via reverse proxy).
 */
export function sendDebugEvent(payload: {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  msg: string;
  data?: Record<string, unknown>;
  ts?: number;
}): void {
  if (typeof window === 'undefined') return;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      ts: payload.ts ?? Date.now(),
    }),
  }).catch(() => {});
}
