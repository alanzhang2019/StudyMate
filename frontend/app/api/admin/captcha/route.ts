import { NextResponse } from 'next/server';

import { issueCaptcha } from '@/lib/admin/captcha';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/captcha
 *
 * 服务端下发验证码：答案经 AES-GCM 加密后写进 httpOnly cookie，
 * 响应体只含 SVG 图。客户端（含攻击者脚本）无法从 cookie 解出答案。
 */
export async function GET() {
  try {
    const { svg, expiresIn } = await issueCaptcha();
    return apiSuccess({ svg, expiresIn });
  } catch (err) {
    return apiError(
      'INTERNAL_ERROR',
      503,
      '验证码服务未就绪：请确认已配置 ADMIN_JWT_SECRET',
      err instanceof Error ? err.message : undefined,
    );
  }
}
