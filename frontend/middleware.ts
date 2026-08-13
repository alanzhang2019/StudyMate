// Edge middleware: gate `/csp-lecture` behind a logged-in user.
//
// Why this lives here and not in `app/csp-lecture/page.tsx`:
//   `page.tsx` is a Server Component that calls `redirect()` from
//   `next/navigation` when there's no session. In Next.js 14 the
//   resulting response is a 307 with the rendered `_next/error`
//   fallback HTML in the body. Chrome / Edge / Safari follow the
//   307 to the login page and the user lands there fine, but
//   WeChat's in-app X5 browser does NOT follow the 307 — it
//   renders the body and shows "404 This page could not be
//   found." A plain 302 from middleware has no body, so X5
//   follows it correctly and the user lands on the login page.
//
// Two-layer gate:
//   1. Middleware (here) does a fast cookie check. If the
//      NextAuth session cookie is present we let the request
//      through without an extra DB / JWT verify round-trip.
//   2. `page.tsx` still calls `auth()` and `redirect()` as a
//      server-side safety net — if the cookie is forged /
//      expired, the page redirect kicks in and the user lands
//      on the login page. This keeps us safe even if middleware
//      was bypassed (e.g. a tampered cookie).
//
// Cookie name coverage:
//   NextAuth v5 defaults to `authjs.session-token` in dev and
//   `__Secure-authjs.session-token` in prod. We also match the
//   v4 names just in case a future rollback ever needs to
//   coexist.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    req.cookies.has(name),
  );
  if (hasSessionCookie) {
    return NextResponse.next();
  }
  // No session cookie — 302 (not 307) to the login page with
  // the same query params the original page.tsx redirect used
  // to send, so the login UI's "create student account" branch
  // keeps working unchanged.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.search = "?redirect=/csp-lecture&as=student";
  return NextResponse.redirect(loginUrl, 302);
}

export const config = {
  // Only run on /csp-lecture — every other route continues to
  // use its own auth flow (page-level `auth()` checks,
  // NextAuth's own signin pages, etc).
  matcher: ["/csp-lecture"],
};
