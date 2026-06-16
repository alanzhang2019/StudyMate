/**
 * Client-side mirror of the visitor cookie.
 *
 * The cookie is httpOnly so plain JS can't read it. Instead we keep
 * a `localStorage` shadow that the server tells us about (via a
 * meta tag injected by `VisitorBootstrap`) and we forward it as
 * the `X-Visitor-Id` request header on every fetch.
 *
 * Why bother with the header at all? Because the route handlers can
 * read it without depending on `next/headers`, which is the
 * simplest path to attributing `usage_events` to a specific visitor
 * even from a `route.ts` that otherwise doesn't care about auth.
 */

const STORAGE_KEY = 'sm_visitor_id';
const HEADER_NAME = 'X-Visitor-Id';

export function getClientVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setClientVisitorId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage may be disabled (private mode, etc.) — that's
    // fine, the server still has the cookie and we'll see the
    // visitor once the user actually makes a request.
  }
}

export function visitorFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const visitorId = getClientVisitorId();
  const headers = new Headers(init.headers ?? {});
  if (visitorId) headers.set(HEADER_NAME, visitorId);
  return fetch(input, { ...init, headers });
}
