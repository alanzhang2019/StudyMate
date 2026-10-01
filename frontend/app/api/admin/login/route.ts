import { cookies } from 'next/headers';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { signAdminToken, verifyAdminPassword } from '@/lib/admin/auth';
import { verifyCaptcha } from '@/lib/admin/captcha';
import { checkLoginAllowed, clientKey, resetLoginAttempts } from '@/lib/admin/rate-limit';
import { trackEvent } from '@/lib/usage/track';

/**
 * POST /api/admin/login
 *
 * P0 之前这里有三个洞，本次全部收敛：
 *   1. `ADMIN_PASSWORD || 'admin123'` —— 环境变量没配就退化成公开弱口令。
 *   2. 验证码完全不在服务端校验 —— 纯前端 canvas 生成并比对，脚本可直接绕过。
 *   3. 无任何失败限流 —— 可以无限撞库。
 *
 * 顺序有讲究：限流 → 验证码 → 凭据 → 签发令牌。
 * 验证码放在凭据之前，撞库前必须先过「一次性验证码」这一关。
 */
export async function POST(request: Request) {
  // ① 限流（按来源 IP，15 分钟内 5 次）
  const key = clientKey(request);
  const guard = checkLoginAllowed(key);
  if (!guard.allowed) {
    const minutes = Math.max(1, Math.ceil(guard.retryAfterSec / 60));
    return apiError('INVALID_REQUEST', 429, `尝试过于频繁，请 ${minutes} 分钟后重试`);
  }

  let body: { username?: string; password?: string; captcha?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求格式有误');
  }

  if (!body.username || !body.password) {
    return apiError('MISSING_REQUIRED_FIELD', 400, '请输入账号和密码');
  }
  if (!body.captcha) {
    return apiError('MISSING_REQUIRED_FIELD', 400, '请输入验证码');
  }

  // ② 服务端校验验证码（一次性，失败即作废，客户端需重新拉图）
  const captcha = await verifyCaptcha(body.captcha);
  if (!captcha.ok) {
    if (captcha.reason === 'NOT_CONFIGURED') {
      return apiError('INTERNAL_ERROR', 503, '服务端未配置密钥，无法校验验证码');
    }
    const msg =
      captcha.reason === 'MISSING'
        ? '验证码已过期，请点击图片刷新后重试'
        : '验证码错误，请重新识别';
    return apiError('INVALID_REQUEST', 400, msg);
  }

  // ③ fail-closed：凭据未配置 → 503 并要求运维配置，绝不回退默认口令
  //    凭据取自「持久卷里的自定义凭据」优先，其次环境变量（见 lib/admin/auth.ts）
  const result = verifyAdminPassword(body.username, body.password);
  if (result === 'unconfigured') {
    return apiError(
      'INTERNAL_ERROR',
      503,
      '管理员凭据未配置：请在环境变量中设置 ADMIN_USERNAME / ADMIN_PASSWORD 后重启服务',
    );
  }
  if (result === 'bad') {
    return apiError('INVALID_REQUEST', 401, '账号或密码错误');
  }

  // ④ 签发令牌；密钥强度不足同样拒绝，避免弱密钥上线
  let token: string;
  try {
    token = await signAdminToken();
  } catch {
    return apiError(
      'INTERNAL_ERROR',
      503,
      '管理端密钥未配置或强度不足（ADMIN_JWT_SECRET 需不少于 32 字符）',
    );
  }

  const cookieStore = await cookies();
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    secure: process.env.NODE_ENV === 'production',
  });

  resetLoginAttempts(key);
  // 不再记录具体用户名：避免把攻击者输入的字符串写进日志。
  void trackEvent('admin.login', { success: true }, { request });

  return apiSuccess({ valid: true });
}
