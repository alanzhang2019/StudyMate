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

function transformStudent(row: any): any {
  return {
    ...row,
    tags: safeJsonParse(row.tags),
  };
}

// GET /api/admin/camp/students：查询学员列表
// query：q（按姓名模糊搜索）、status（active/dropped/graduated）、className（班级名精确匹配）
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim();
    const status = url.searchParams.get('status')?.trim();
    const className = url.searchParams.get('className')?.trim();

    const whereSql: string[] = [];
    const params: any[] = [];

    if (q) {
      whereSql.push('name LIKE ?');
      params.push(`%${q}%`);
    }
    if (status) {
      whereSql.push('status = ?');
      params.push(status);
    }
    if (className) {
      whereSql.push('className = ?');
      params.push(className);
    }

    let sql = 'SELECT * FROM camp_students';
    if (whereSql.length > 0) {
      sql += ` WHERE ${whereSql.join(' AND ')}`;
    }
    sql += ' ORDER BY createdAt DESC';

    const rawRows = getDb().prepare(sql).all(...params) as any[];
    const students = rawRows.map(transformStudent);

    return NextResponse.json({ success: true, data: students });
  } catch (error) {
    console.error('[camp/students GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取学员列表失败' },
      { status: 500 },
    );
  }
});

// POST /api/admin/camp/students：创建学员
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();

    const {
      name,
      gender,
      grade,
      school,
      parentName,
      parentPhone,
      className,
      tags,
      notes,
      status,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '学员姓名不能为空' },
        { status: 400 },
      );
    }

    const tagsArr = Array.isArray(tags) ? tags : [];
    const tagsJson = JSON.stringify(tagsArr);

    const data: any = {
      name: name.trim(),
      tags: tagsJson,
    };
    if (gender !== undefined && gender !== null && gender !== '') {
      data.gender = gender;
    }
    if (grade !== undefined && grade !== null && grade !== '') {
      data.grade = grade;
    }
    if (school !== undefined && school !== null && school !== '') {
      data.school = school;
    }
    if (parentName !== undefined && parentName !== null && parentName !== '') {
      data.parentName = parentName;
    }
    if (parentPhone !== undefined && parentPhone !== null && parentPhone !== '') {
      data.parentPhone = parentPhone;
    }
    if (className !== undefined && className !== null && className !== '') {
      data.className = className;
    }
    if (notes !== undefined && notes !== null && notes !== '') {
      data.notes = notes;
    }
    if (status !== undefined && status !== null && status !== '') {
      data.status = status;
    }

    const created = await db.campStudent.create({ data });

    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error) {
    console.error('[camp/students POST] error:', error);
    return NextResponse.json(
      { success: false, error: '创建学员失败' },
      { status: 500 },
    );
  }
});
