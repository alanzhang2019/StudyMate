import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

/**
 * Server-side helpers for the anonymous visitor cookie.
 *
 * The flow is:
 *   1. First time a user hits the site, `getOrCreateVisitorId()` mints
 *      a UUID and writes it to an httpOnly cookie that lasts 1 year.
 *   2. Every API route that wants to attribute an event to the visitor
 *      calls `getVisitorId()` to read the cookie.
 *   3. The client mirror at `lib/visitor/client.ts` reads the same
 *      value and forwards it as the `X-Visitor-Id` request header so
 *      the route handlers can attribute events even when cookies
 *      aren't sent (e.g. during a server-side fetch).
 *
 * The cookie is httpOnly, so client JS can't tamper with it.
 */

export const VISITOR_COOKIE = 'sm_visitor_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getVisitorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? null;
}

export async function getOrCreateVisitorId(): Promise<{
  visitorId: string;
  created: boolean;
}> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return { visitorId: existing, created: false };

  const visitorId = randomUUID();
  store.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
  return { visitorId, created: true };
}
