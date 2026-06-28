/**
 * Server-side helpers for the parent-side visitor cookie.
 *
 * We deliberately do NOT reuse `sm_visitor_id` (the student
 * cookie) for parents. The two are independent identities: a
 * device that visits both `/` (student) and `/parent/dashboard`
 * (parent) keeps a stable parent id even after the student
 * session is wiped (and vice versa), so the parent never loses
 * access to a previously-bound child.
 */

import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

export const PARENT_VISITOR_COOKIE = 'sm_parent_visitor_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getParentVisitorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(PARENT_VISITOR_COOKIE)?.value ?? null;
}

/**
 * Read-or-mint the parent visitor id and PERSIST it in the
 * cookie. Use this from `/parent/*` API route handlers so the
 * next request from the same device still sees the same id.
 */
export async function getOrCreateParentVisitorId(): Promise<{
  parentVisitorId: string;
  created: boolean;
}> {
  const store = await cookies();
  const existing = store.get(PARENT_VISITOR_COOKIE)?.value;
  if (existing) return { parentVisitorId: existing, created: false };

  const parentVisitorId = randomUUID();
  store.set(PARENT_VISITOR_COOKIE, parentVisitorId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
  return { parentVisitorId, created: true };
}

export async function clearParentVisitorId(): Promise<void> {
  const store = await cookies();
  store.set(PARENT_VISITOR_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}
