import { NextResponse } from 'next/server';

import { clearParentVisitorId } from '@/lib/parent/visitor';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parent/logout
 *
 * Wipe the parent-side cookie. Tiny endpoint so the logout
 * button can do a single round-trip and then navigate.
 */
export async function POST() {
  await clearParentVisitorId();
  return NextResponse.json({ success: true });
}
