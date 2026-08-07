import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mistake-book/[id]/review/cause
 *
 * 第 1 段: 保存学生自述的错因 (自由文本 + 分类).
 * 任何阶段都可以重新保存 (覆盖之前), 鼓励学生"改主意".
 *
 * Body: { cause: string, category: 'careless'|'wrong_approach'|'missing_knowledge'|'other' }
 */
const VALID_CATEGORIES = new Set([
  'careless',
  'wrong_approach',
  'missing_knowledge',
  'other',
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json(
      { success: false, error: 'No visitor session' },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const cause = typeof body.cause === 'string' ? body.cause.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      { success: false, error: 'category is required and must be valid' },
      { status: 400 },
    );
  }
  if (!cause) {
    return NextResponse.json(
      { success: false, error: 'cause is required' },
      { status: 400 },
    );
  }
  // 防止学生把整段大段贴进来 — 50-200 字以内为宜
  if (cause.length > 500) {
    return NextResponse.json(
      { success: false, error: 'cause too long (max 500 chars)' },
      { status: 400 },
    );
  }

  const existing = db.mistakeBook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    );
  }
  if (existing.visitorId !== visitorId) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const updated = db.mistakeBook.update({
    where: { id },
    data: {
      errorCause: cause,
      errorCauseCategory: category,
      updatedAt: nowIso,
    },
  });

  return NextResponse.json({ success: true, item: updated });
}
