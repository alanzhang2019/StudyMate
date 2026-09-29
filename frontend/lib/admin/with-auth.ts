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
      // verifyAdminToken 失败时返回 null，必须显式判断。
      // 不能只依赖抛异常：一旦实现改成不抛异常，旧的 try/catch 写法会静默放行。
      const payload = await verifyAdminToken(token);
      if (!payload) {
        return apiError('INVALID_REQUEST', 401, '登录已过期或无效');
      }
    } catch (err) {
      return apiError('INVALID_REQUEST', 401, '登录已过期或无效');
    }
    return handler(...args);
  }) as T;
}
