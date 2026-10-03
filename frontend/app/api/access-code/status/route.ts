import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/access-token';

// 必须动态求值。ACCESS_CODE 只在运行时才可知，登录态又存在 cookie 里；
// 一旦被静态优化，就会把「构建时未配置 ACCESS_CODE」的结果（enabled:false）
// 固化下来，导致之后配了密码也永远不弹门禁。
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const accessCode = process.env.ACCESS_CODE;
  const enabled = !!accessCode;

  // 无条件读取 cookies，既拿到登录态，也让本路由明确处于动态渲染。
  const cookieStore = await cookies();

  let authenticated = false;
  if (accessCode) {
    const token = cookieStore.get('openmaic_access')?.value;
    authenticated = !!token && verifyAccessToken(token, accessCode);
  }

  return apiSuccess({ enabled, authenticated });
}
