import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';

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

// GET /api/admin/camp/students/:id
export const GET = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const student = await db.campStudent.findUnique({ where: { id } });

    if (!student) {
      return NextResponse.json(
        { success: false, error: '学员不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: transformStudent(student) });
  } catch (error) {
    console.error('[camp/students/:id GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取学员详情失败' },
      { status: 500 },
    );
  }
});

// PATCH /api/admin/camp/students/:id
export const PATCH = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campStudent.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '学员不存在' },
        { status: 404 },
      );
    }

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

    const data: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { success: false, error: '学员姓名不能为空' },
          { status: 400 },
        );
      }
      data.name = name.trim();
    }
    if (gender !== undefined) {
      data.gender = gender === '' ? null : gender;
    }
    if (grade !== undefined) {
      data.grade = grade === '' ? null : grade;
    }
    if (school !== undefined) {
      data.school = school === '' ? null : school;
    }
    if (parentName !== undefined) {
      data.parentName = parentName === '' ? null : parentName;
    }
    if (parentPhone !== undefined) {
      data.parentPhone = parentPhone === '' ? null : parentPhone;
    }
    if (className !== undefined) {
      data.className = className === '' ? null : className;
    }
    if (tags !== undefined) {
      const tagsArr = Array.isArray(tags) ? tags : [];
      data.tags = JSON.stringify(tagsArr);
    }
    if (notes !== undefined) {
      data.notes = notes === '' ? null : notes;
    }
    if (status !== undefined) {
      data.status = status;
    }

    await db.campStudent.update({ where: { id }, data });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/students/:id PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: '更新学员失败' },
      { status: 500 },
    );
  }
});

// DELETE /api/admin/camp/students/:id
export const DELETE = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campStudent.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '学员不存在' },
        { status: 404 },
      );
    }

    await db.campStudent.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/students/:id DELETE] error:', error);
    return NextResponse.json(
      { success: false, error: '删除学员失败' },
      { status: 500 },
    );
  }
});
