import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';
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

// GET /api/admin/camp/works：作品列表
// query：status?(pending/approved/rejected), className?, studentId?, category?, featured?(1/0)
// 默认 orderBy createdAt desc，如传 sort=featured 则按 featured desc, sortOrder, createdAt desc
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status')?.trim();
    const className = url.searchParams.get('className')?.trim();
    const studentId = url.searchParams.get('studentId')?.trim();
    const category = url.searchParams.get('category')?.trim();
    const featured = url.searchParams.get('featured')?.trim();
    const sort = url.searchParams.get('sort')?.trim();

    const whereSql: string[] = [];
    const params: any[] = [];

    if (status) {
      whereSql.push('status = ?');
      params.push(status);
    }
    if (className) {
      whereSql.push('className = ?');
      params.push(className);
    }
    if (studentId) {
      whereSql.push('studentId = ?');
      params.push(studentId);
    }
    if (category) {
      whereSql.push('category = ?');
      params.push(category);
    }
    if (featured !== undefined && featured !== null && featured !== '') {
      const f = featured === '1' ? 1 : 0;
      whereSql.push('featured = ?');
      params.push(f);
    }

    let sql = 'SELECT * FROM camp_works';
    if (whereSql.length > 0) {
      sql += ` WHERE ${whereSql.join(' AND ')}`;
    }
    if (sort === 'featured') {
      sql += ' ORDER BY featured DESC, sortOrder ASC, createdAt DESC';
    } else {
      sql += ' ORDER BY createdAt DESC';
    }

    const rawRows = getDb().prepare(sql).all(...params) as any[];
    const works = rawRows.map(transformWork);

    return NextResponse.json({ success: true, data: works });
  } catch (error) {
    console.error('[camp/works GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取作品列表失败' },
      { status: 500 },
    );
  }
});

// POST /api/admin/camp/works：创建作品
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();

    const {
      title,
      studentId,
      studentName,
      className,
      classLogId,
      category,
      coverImage,
      linkUrl,
      description,
      techStack,
      featured,
      sortOrder,
    } = body;

    if (!title || !studentId) {
      return NextResponse.json(
        { success: false, error: '作品标题和关联学员ID为必填项' },
        { status: 400 },
      );
    }

    const techStackArr = Array.isArray(techStack) ? techStack : [];

    const data: any = {
      title,
      studentId,
      techStackJson: JSON.stringify(techStackArr),
    };

    if (studentName !== undefined && studentName !== null && studentName !== '') {
      data.studentName = studentName;
    }
    if (className !== undefined && className !== null && className !== '') {
      data.className = className;
    }
    if (classLogId !== undefined && classLogId !== null && classLogId !== '') {
      data.classLogId = classLogId;
    }
    if (category !== undefined && category !== null && category !== '') {
      data.category = category;
    }
    if (coverImage !== undefined && coverImage !== null && coverImage !== '') {
      data.coverImage = coverImage;
    }
    if (linkUrl !== undefined && linkUrl !== null && linkUrl !== '') {
      data.linkUrl = linkUrl;
    }
    if (description !== undefined && description !== null && description !== '') {
      data.description = description;
    }
    if (featured !== undefined && featured !== null && featured !== '') {
      const f = Number(featured);
      if (!Number.isNaN(f)) data.featured = f === 1 ? 1 : 0;
    }
    if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '') {
      const n = Number(sortOrder);
      if (!Number.isNaN(n)) data.sortOrder = n;
    }

    const created = await db.campWork.create({ data });

    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error: any) {
    console.error('[camp/works POST] error:', error)
    return NextResponse.json(
      { success: false, error: `创建作品失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
});
