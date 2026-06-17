import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

/**
 * Server-side helpers for the anonymous visitor cookie.
 *
 * The flow is:
 *   1. First time a user hits the site, `middleware.ts` mints a UUID
 *      and writes it to an httpOnly cookie that lasts 1 year.
 *   2. The root `app/layout.tsx` reads the cookie via
 *      `getOrGenerateVisitorId()` — NEVER writes to cookies here,
 *      because Next.js prerenders `/` at build time and disallows
 *      cookie writes in that phase. If no cookie is present (e.g.
 *      during a static prerender), we mint a throwaway id; the real
 *      one is set on the first real user request via middleware.
 *   3. Every API route that wants to attribute an event to the visitor
 *      calls `getOrCreateVisitorId()` (which writes the cookie so the
 *      next request sees the same id), or reads `getVisitorId()` if
 *      the caller already wrote it (e.g. middleware did).
 *   4. The client mirror at `lib/visitor/client.ts` reads the same
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

/**
 * Read-only visitor id resolver. Safe to call from the root layout,
 * including during build-time prerender of `/`. If no cookie is
 * present we generate a *throwaway* id that lives only for the
 * duration of this render; the persistent id is set on the first
 * real user request by `middleware.ts`.
 */
export async function getOrGenerateVisitorId(): Promise<string> {
  const existing = await getVisitorId();
  if (existing) return existing;
  return randomUUID();
}

/**
 * Read-or-mint the visitor id and PERSIST it in the httpOnly cookie.
 * Use this from API route handlers (where cookie writes are allowed).
 * Do NOT call this from `app/layout.tsx` or any other component
 * rendered during build-time prerender — that will crash the build
 * with "Cookies can only be modified in a Server Action or Route
 * Handler".
 */
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
