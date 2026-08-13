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
//   found."
//
//   A plain 302 from middleware looks like the obvious fix, but
//   it isn't. The Next.js 14 middleware pipeline post-processes
//   every 3xx response that carries a `Location` header:
//     * `NextResponse.redirect(url)`  → 302 with the URL as body
//       (47 bytes) and `Transfer-Encoding: chunked`.
//     * `new NextResponse(null, { status: 302, headers: { Location } })`
//       → still ends up rewritten to relative Location + URL as
//       body + chunked (the framework overrides your headers).
//     * `new Response(null, …)`  → 500 Internal Server Error in
//       the edge runtime (the framework patches `Response.prototype`
//       and a vanilla instance crashes the pipeline).
//     * `new NextResponse(null, { status: 302, Location: '/auth/...' })`
//       → `ERR_INVALID_URL` (Location must be absolute).
//     * `new NextResponse(null, { status: 302, Location: '<abs URL>' })`
//       → Location is downgraded back to relative, body filled
//       with URL, forced to chunked. Same as `NextResponse.redirect`.
//   In every variant X5 receives a 3xx with a non-empty body and
//   refuses to follow it, rendering the body text as "404 page
//   not found".
//
// What works:
//   Return a 200 OK HTML page with a `<meta http-equiv="refresh">`
//   tag plus a `<script>window.location.replace(...)</script>`
//   fallback. Status 200 means the framework leaves the body
//   alone (no Location post-processing), and X5 happily parses
//   both the meta tag and the script to navigate. The HTML is
//   ~400 bytes and served from the edge, so the visible flash
//   is sub-100ms.
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
  // No session cookie — gate the user behind the login page.
  //
  // Why not a plain 302 / 307:
  //   `page.tsx`'s `redirect()` produces a 307 with the rendered
  //   `_next/error` HTML in the body. `NextResponse.redirect()`
  //   and even a hand-rolled `new NextResponse(null, { status: 302,
  //   headers: { Location } })` both end up with the Location URL
  //   as response body and `Transfer-Encoding: chunked`, because
  //   Next.js 14's middleware pipeline post-processes any 3xx
  //   response that carries a `Location` header — it treats them
  //   as framework-issued redirects and rewrites the body. WeChat's
  //   in-app X5 browser refuses to follow 3xx responses that have
  //   a non-empty body: it renders the body text and shows "404
  //   page not found" instead. The X5 bug is well-known and does
  //   not affect 200 OK HTML pages.
  //
  // Workaround: return a 200 OK HTML page with a
  //   <meta http-equiv="refresh"> tag and a JS fallback. Status 200
  //   means the middleware response pipeline leaves the body alone
  //   (no Location post-processing), and X5 happily parses both the
  //   meta tag and the script to navigate. The HTML is tiny (~400
  //   bytes) and served from the edge, so the visible flash is
  //   sub-100ms.
  // `new URL(target, req.url)` resolves the relative path against
  // `req.url`, but in Next.js 14 `req.url` is the internal listen
  // URL of the Node process (e.g. `http://0.0.0.0:3001/...`),
  // NOT the public host that the user typed in their browser.
  // That makes the meta-refresh target `https://0.0.0.0:3001/...`
  // which only works from inside the container, not from a
  // WeChat client on the public internet. Re-anchor the URL to
  // the request's `Host` header (or `X-Forwarded-Host` if the
  // reverse proxy is passing it through), and the
  // `X-Forwarded-Proto` (or default to `https` for prod).
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host") ?? req.nextUrl.host;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? (req.nextUrl.protocol.replace(":", "") || "https");
  const publicLoginUrl = `${proto}://${host}${LOGIN_REDIRECT_TARGET}`;
  // Escape the URL for safe inclusion in:
  //   * the `content` attribute of <meta http-equiv="refresh"> —
  //     needs HTML entity escaping for `&`, `"`, `<`, `>`.
  //   * a single-quoted JS string literal inside the inline
  //     `<script>` — needs `\` and `'` escaped.
  // We do both passes rather than `encodeURI` because `encodeURI`
  // would over-escape `&` to `%26` and break the query string
  // when it lands back in the address bar of the login page.
  const safeUrl = publicLoginUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const jsUrl = publicLoginUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${safeUrl}">
<title>\u6b63\u5728\u8df3\u8f6c\u2026</title>
<script>window.location.replace('${jsUrl}');</script>
</head>
<body>
<p>\u6b63\u5728\u8df3\u8f6c\u5230\u767b\u5f55\u9875\u2026</p>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
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
