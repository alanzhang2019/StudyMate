import { NextResponse } from 'next/server';

import { getOrCreateParentVisitorId } from '@/lib/parent/visitor';
import { redeemInviteCode } from '@/lib/parent/invite';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/invite/redeem
 *
 * Parent-side: type the 6-digit code from the student and we
 * create the long-term binding. On success, the parent's
 * `sm_parent_visitor_id` cookie is set so subsequent visits
 * don't need to re-enter the code.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { code } = (body ?? {}) as { code?: unknown };
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: '请输入 6 位数字绑定码' },
      { status: 400 },
    );
  }

  const { parentVisitorId } = await getOrCreateParentVisitorId();
  const result = redeemInviteCode(code, parentVisitorId);

  if (!result.ok) {
    const message =
      result.reason === 'not-found'
        ? '绑定码不存在，请让孩子重新生成'
        : result.reason === 'expired'
        ? '绑定码已过期（10 分钟内有效），请让孩子重新生成'
        : '绑定码已被使用，每个码只能绑定一次';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    studentVisitorId: result.studentVisitorId,
    parentBindingId: result.parentBindingId,
    alreadyBound: result.alreadyBound,
  });
}
