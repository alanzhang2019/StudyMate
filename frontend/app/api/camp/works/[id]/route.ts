import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function safeJsonParse(str: string | null | undefined): any[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function transformWork(row: any): any {
  return {
    ...row,
    techStack: safeJsonParse(row.techStackJson),
  };
}

// GET /api/camp/works/:id：公开作品详情（无需登录）
// 仅返回 status = 'approved' 的作品；其余一律 404，避免泄露待审核/已拒作品。
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const row = getDb()
      .prepare('SELECT * FROM camp_works WHERE id = ? LIMIT 1')
      .get(id) as any;

    if (!row || row.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: transformWork(row) });
  } catch (error) {
    console.error('[camp/works/:id public GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取作品详情失败' },
      { status: 500 },
    );
  }
};
