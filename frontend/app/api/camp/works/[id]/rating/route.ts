import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOrCreateVisitorId } from '@/lib/visitor/server';
import { ratingSummary, workIsDiscussable } from '@/lib/server/camp-discussion';

/**
 * POST   /api/camp/works/:id/rating —— 打分（1-5），公开、匿名
 * DELETE /api/camp/works/:id/rating —— 撤掉自己的评分
 *
 * 同一访客对同一作品只有一票：表主键是 (workId, visitorId)，
 * 重复打分走 UPSERT 覆盖，而不是叠加。这样「最受欢迎」不会被刷。
 */

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    if (!workIsDiscussable(id)) {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
    }

    const score = Math.round(Number(payload.score));
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      return NextResponse.json(
        { success: false, error: '请给 1-5 星的评分' },
        { status: 400 },
      );
    }

    const { visitorId } = await getOrCreateVisitorId();

    getDb()
      .prepare(
        `INSERT INTO camp_work_ratings (workId, visitorId, score, createdAt, updatedAt)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(workId, visitorId)
         DO UPDATE SET score = excluded.score, updatedAt = datetime('now')`,
      )
      .run(id, visitorId, score);

    return NextResponse.json({
      success: true,
      data: { rating: ratingSummary(id, visitorId) },
    });
  } catch (error) {
    console.error('[camp/works/:id/rating POST] error:', error);
    return NextResponse.json({ success: false, error: '评分失败，请稍后再试' }, { status: 500 });
  }
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { visitorId } = await getOrCreateVisitorId();

    getDb()
      .prepare('DELETE FROM camp_work_ratings WHERE workId = ? AND visitorId = ?')
      .run(id, visitorId);

    return NextResponse.json({
      success: true,
      data: { rating: ratingSummary(id, visitorId) },
    });
  } catch (error) {
    console.error('[camp/works/:id/rating DELETE] error:', error);
    return NextResponse.json({ success: false, error: '撤销评分失败' }, { status: 500 });
  }
};
