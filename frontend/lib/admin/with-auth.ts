import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from './auth';
import { apiError } from '@/lib/server/api-response';

/**
 * Route handler wrapper that enforces a valid admin_token cookie.
 * Use around any GET/POST handler under /api/admin/* that needs
 * real auth protection (which is all of them except /login).
 *
 * Usage:
 *   export const GET = withAdminAuth(async () => NextResponse.json(...));
 */
export function withAdminAuth<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
): T {
  return (async (...args: any[]) => {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_token')?.value;
      if (!token) {
        return apiError('INVALID_REQUEST', 401, '未登录');
      }
      await verifyAdminToken(token);
    } catch (err) {
      return apiError('INVALID_REQUEST', 401, '登录已过期或无效');
    }
    return handler(...args);
  }) as T;
}
