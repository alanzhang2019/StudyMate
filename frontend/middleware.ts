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
//   found." A plain 302 from middleware normally fixes this, BUT
//   in Next.js 14 production `NextResponse.redirect()` also
//   attaches the Location URL as a small text body (47 bytes),
//   and `Transfer-Encoding: chunked` is set automatically. X5
//   receives a 302 with a non-empty body and again refuses to
//   follow the redirect, rendering the URL text as a "page not
//   found" error. Forcing `new Response(null, …)` with an
//   explicit `Content-Length: 0` header produces a true empty
//   body that X5 follows per HTTP spec.
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

const LOGIN_REDIRECT_TARGET = "/auth/login?redirect=/csp-lecture&as=student";

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    req.cookies.has(name),
  );
  if (hasSessionCookie) {
    // Pass through to the page; auth() inside the server component
    // still enforces the redirect for users whose cookie was rejected
    // by the JWT verification step.
    return NextResponse.next();
  }
  // No session cookie — 302 (not 307) to the login page with
  // the same query params the original page.tsx redirect used
  // to send, so the login UI's "create student account" branch
  // keeps working unchanged. We deliberately hand-roll a
  // `new Response(null, …)` instead of calling
  // `NextResponse.redirect()`, because in Next.js 14 production
  // the latter attaches the Location URL as response body and
  // `Transfer-Encoding: chunked`, which causes WeChat's X5
  // browser to render the body and show "404 page not found"
  // instead of following the redirect. The explicit
  // `Content-Length: 0` header prevents Next.js from falling
  // back to chunked encoding.
  return new Response(null, {
    status: 302,
    headers: {
      Location: LOGIN_REDIRECT_TARGET,
      "Content-Length": "0",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const config = {
  // Only run on /csp-lecture — every other route continues to
  // use its own auth flow (page-level `auth()` checks,
  // NextAuth's own signin pages, etc).
  matcher: ["/csp-lecture"],
};
