import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';

/**
 * GET /api/admin/camp/comments —— 讨论区评论列表（按时间倒序）
 *
 * 公开讨论区是匿名的，孩子作品墙一旦有不合适的内容必须能立刻处理，
 * 所以管理后台提供只读列表 + 删除。workId 可能是静态种子作品 slug
 * （不在 camp_works 里），LEFT JOIN 后 title 为空，前端显示 slug 即可。
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? '100');
    const limit = Math.min(Math.max(Math.round(limitRaw) || 100, 1), 300);

    const rows = getDb()
      .prepare(
        `SELECT c.id, c.workId, c.parentId, c.authorName, c.authorRole, c.body,
                c.status, c.createdAt, w.title AS workTitle
         FROM camp_work_comments c
         LEFT JOIN camp_works w ON w.id = c.workId
         ORDER BY c.createdAt DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      workId: string;
      parentId: string | null;
      authorName: string;
      authorRole: string | null;
      body: string;
      status: string;
      createdAt: string;
      workTitle: string | null;
    }>;

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('[admin/camp/comments GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取评论列表失败' },
      { status: 500 },
    );
  }
});
