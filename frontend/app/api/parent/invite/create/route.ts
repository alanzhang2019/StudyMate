import { NextResponse } from 'next/server';

import { getOrCreateVisitorId } from '@/lib/visitor/server';
import { createInviteCode } from '@/lib/parent/invite';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/invite/create
 *
 * Student-side: mint a fresh 6-digit invite code bound to the
 * current visitor. The student's own cookie is required; the
 * code is what the parent will type on their phone.
 */
export async function POST() {
  // Read-or-mint so first-time visitors (e.g. a student who has
  // only opened /mistake-book but never /mistake) can still
  // invite their parents without a separate bootstrap step.
  const { visitorId: studentVisitorId } = await getOrCreateVisitorId();

  try {
    const result = createInviteCode(studentVisitorId);
    return NextResponse.json({
      success: true,
      code: result.code,
      expiresAt: result.expiresAt,
      ttlSeconds: 10 * 60,
    });
  } catch (err) {
    console.error('[/api/parent/invite/create] failed', err);
        return NextResponse.json(
          {
            error: '短码生成失败，请稍后重试',
            debug: err instanceof Error ? err.message : String(err),
          },
          { status: 500 },
        );
  }
}
