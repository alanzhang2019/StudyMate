import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor/server';
import { listComments, ratingSummary, workIsDiscussable } from '@/lib/server/camp-discussion';

/**
 * DELETE /api/camp/works/:id/comments/:commentId —— 删掉「自己」的评论
 *
 * 判定自己的唯一依据是 httpOnly cookie 里的访客 id（不可伪造 JS 篡改），
 * 不是昵称 —— 否则填个一样的名字就能删别人的评论。
 * 删自己评论时会连带删掉挂在它下面的回复，避免留下悬空 replies。
 */

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) => {
  try {
    const { id, commentId } = await params;
    const visitorId = await getVisitorId();

    if (!visitorId) {
      return NextResponse.json({ success: false, error: '无法识别身份' }, { status: 401 });
    }
    if (!workIsDiscussable(id)) {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }

    const row = getDb()
      .prepare(
        `SELECT id, authorVisitorId FROM camp_work_comments
         WHERE id = ? AND workId = ? LIMIT 1`,
      )
      .get(commentId, id) as { id: string; authorVisitorId: string | null } | undefined;

    if (!row || row.authorVisitorId !== visitorId) {
      return NextResponse.json(
        { success: false, error: '只能删除自己的评论' },
        { status: 403 },
      );
    }

    const db = getDb();
    // 连带清理：该评论下的回复
    db.prepare('DELETE FROM camp_work_comments WHERE parentId = ?').run(commentId);
    db.prepare('DELETE FROM camp_work_comments WHERE id = ?').run(commentId);

    return NextResponse.json({
      success: true,
      data: {
        comments: listComments(id, visitorId),
        rating: ratingSummary(id, visitorId),
      },
    });
  } catch (error) {
    console.error('[camp/works/:id/comments/:commentId DELETE] error:', error);
    return NextResponse.json({ success: false, error: '删除失败，请稍后再试' }, { status: 500 });
  }
};
