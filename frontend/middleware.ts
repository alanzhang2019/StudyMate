import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin/auth';

const VISITOR_COOKIE = 'sm_visitor_id';
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Convert string to Uint8Array */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert ArrayBuffer to hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verify an HMAC-signed token using Web Crypto API (Edge-compatible) */
async function verifyToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(accessCode);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const data = encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));

  // Constant-length comparison (not truly constant-time in JS, but sufficient here)
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Short-circuit CORS preflight for integration endpoints. The browser
  // sends OPTIONS before the real POST/GET, and we want to answer with
  // the CORS headers directly from middleware so the real route handler
  // never has to think about it.
  if (
    pathname.startsWith('/api/integrations/') &&
    request.method === 'OPTIONS'
  ) {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(request, pathname),
    });
  }

  // Build a response by running the existing access-control pipeline
  // first, then attach the visitor cookie to whatever the pipeline
  // decides to return. This keeps the visitor-id contract in one
  // place and means every code path (page, API, redirect, json)
  // ends up setting the cookie on the first hit.
  const response = await runAccessControl(request, pathname);

  // Attach CORS headers to every response on the integration surface,
  // including error responses (401/429/etc.) so the browser can read
  // the JSON body from a cross-origin caller.
  if (pathname.startsWith('/api/integrations/')) {
    const corsHeaders = buildCorsHeaders(request, pathname);
    for (const [key, value] of corsHeaders.entries()) {
      response.headers.set(key, value);
    }
  }

  // Mint a visitor id once per request, only if the browser hasn't
  // sent one yet. We do this for *every* response (including 401s
  // and redirects) so that the very first API call from a new
  // browser still gets attributed.
  const existingVisitor = request.cookies.get(VISITOR_COOKIE);
  if (!existingVisitor?.value) {
    // Web Crypto API is available in both Node 18+ and the Edge
    // Runtime that Next.js middleware uses. We can't pull in
    // node:crypto here because webpack would refuse to bundle it.
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

function parseAllowedOrigins(): string[] | '*' {
  const raw = process.env.INTEGRATION_CORS_ORIGINS?.trim();
  if (!raw) return [];
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildCorsHeaders(request: NextRequest, _pathname: string): Headers {
  const allowed = parseAllowedOrigins();
  const requestOrigin = request.headers.get('origin');
  const headers = new Headers();

  if (allowed === '*') {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
    return headers;
  }

  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }

  return headers;
}

async function runAccessControl(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse> {
  // Protect admin API routes (excluding login)
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    const adminToken = request.cookies.get('admin_token');
    if (!adminToken?.value) {
      return NextResponse.json(
        { success: false, errorCode: 'UNAUTHORIZED', error: 'Admin access required' },
        { status: 401 },
      );
    }
    try {
      await verifyAdminToken(adminToken.value);
    } catch (error) {
      return NextResponse.json(
        { success: false, errorCode: 'UNAUTHORIZED', error: 'Invalid admin token' },
        { status: 401 },
      );
    }
  }

  // Protect admin page routes (excluding login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminToken = request.cookies.get('admin_token');
    let isValid = false;
    if (adminToken?.value) {
      try {
        await verifyAdminToken(adminToken.value);
        isValid = true;
      } catch (error) {
        isValid = false;
      }
    }
    if (!isValid) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.next();
  }

  // Whitelist: access-code endpoints, health check
  if (pathname.startsWith('/api/access-code/') || pathname === '/api/health' || pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  // Check cookie — validate HMAC signature, not just existence
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyToken(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
