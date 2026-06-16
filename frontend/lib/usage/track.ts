import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';

/**
 * Lightweight, fire-and-forget usage event tracking.
 *
 * - Called from server-side API routes only. Never import this from a
 *   client component, because it pulls in `better-sqlite3` which would
 *   blow up the browser bundle.
 * - Persists into the `usage_events` table declared in `lib/db.ts`.
 * - The `payload` column is JSON-serialised. Keep it small; this is
 *   meant for product-level analytics, not full request logs.
 */
export type UsageEventName =
  | 'mistake.extract'
  | 'mistake.session.create'
  | 'mistake.session.analyze'
  | 'mistake.session.generate_classroom'
  | 'mistake.session.complete'
  | 'admin.login'
  | 'landing.cta_click';

export async function trackEvent(
  eventName: UsageEventName,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const id = randomUUID();
    const json = payload ? JSON.stringify(payload) : null;
    // Use the Prisma-compat `db` shim so we go through the same WAL
    // connection as everything else, instead of opening a parallel
    // handle that could race with the main one.
    await db.usageEvent.create({
      data: {
        id,
        eventName,
        payload: json as any,
      } as any,
    });
  } catch (err) {
    // Tracking is best-effort. Never let a stats failure break the
    // user-facing request. Log and move on.
    console.warn('[usage/track] failed to record event', eventName, err);
  }
}
