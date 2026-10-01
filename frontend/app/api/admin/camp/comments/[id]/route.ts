import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';

/**
 * DELETE /api/admin/camp/comments/:id —— 管理员删除任意评论（含回复）
 *
 * 游客只能删自己的（/api/camp/works/:id/comments/:commentId），
 * 管理员这条用于内容治理：删顶层评论时连带删掉其下回复。
 */
export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const db = getDb();

      const row = db
        .prepare('SELECT id FROM camp_work_comments WHERE id = ? LIMIT 1')
        .get(id) as { id: string } | undefined;

      if (!row) {
        return NextResponse.json(
          { success: false, error: '评论不存在' },
          { status: 404 },
        );
      }

      db.prepare('DELETE FROM camp_work_comments WHERE parentId = ?').run(id);
      const info = db.prepare('DELETE FROM camp_work_comments WHERE id = ?').run(id);

      return NextResponse.json({ success: true, deleted: info.changes });
    } catch (error) {
      console.error('[admin/camp/comments/:id DELETE] error:', error);
      return NextResponse.json(
        { success: false, error: '删除评论失败' },
        { status: 500 },
      );
    }
  },
);
