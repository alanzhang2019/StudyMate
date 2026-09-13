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

// GET /api/camp/works：公开作品墙数据（无需登录）
// 仅返回 status = 'approved' 的作品，顺序：精选置顶 → sortOrder → 创建时间倒序。
// query：category?(作品/项目/代码/其他)、featured?(1)
export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category')?.trim();
    const featured = url.searchParams.get('featured')?.trim();

    const whereSql: string[] = ['status = ?'];
    const params: any[] = ['approved'];

    if (category) {
      whereSql.push('category = ?');
      params.push(category);
    }
    if (featured === '1') {
      whereSql.push('featured = ?');
      params.push(1);
    }

    const sql =
      `SELECT * FROM camp_works WHERE ${whereSql.join(' AND ')} ` +
      'ORDER BY featured DESC, sortOrder ASC, createdAt DESC';

    const rawRows = getDb().prepare(sql).all(...params) as any[];
    const works = rawRows.map(transformWork);

    return NextResponse.json({ success: true, data: works });
  } catch (error) {
    console.error('[camp/works public GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取作品列表失败' },
      { status: 500 },
    );
  }
};
