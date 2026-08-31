import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Admin logout: clear the `admin_token` cookie (issued by
 * /api/admin/login) and redirect to the admin login page.
 *
 * This endpoint does NOT require withAdminAuth: an admin whose
 * token has already expired should still be able to log out.
 */
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.set('admin_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
  // 302 to /admin/login — Content-Length: 0 avoids the WeChat X5
  // body-rendering bug documented in middleware.ts.
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: '/admin/login',
      'Content-Length': '0',
      'Cache-Control': 'no-store',
    },
  });
}
