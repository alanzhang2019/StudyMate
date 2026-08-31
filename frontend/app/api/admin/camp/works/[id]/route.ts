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

function transformWork(row: any): any {
  return {
    ...row,
    techStack: safeJsonParse(row.techStackJson),
  };
}

// GET /api/admin/camp/works/:id
export const GET = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const work = await db.campWork.findUnique({ where: { id } });

    if (!work) {
      return NextResponse.json(
        { success: false, error: '作品不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: transformWork(work) });
  } catch (error) {
    console.error('[camp/works/:id GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取作品详情失败' },
      { status: 500 },
    );
  }
});

// PATCH /api/admin/camp/works/:id
// 额外支持审核：当传 status 时，自动写入 reviewedAt = 当前 ISO 时间戳，reviewedBy = 'admin'
export const PATCH = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campWork.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '作品不存在' },
        { status: 404 },
      );
    }

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
      status,
      reviewNote,
    } = body;

    const data: any = {
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) {
      if (!title) {
        return NextResponse.json(
          { success: false, error: '作品标题不能为空' },
          { status: 400 },
        );
      }
      data.title = title;
    }
    if (studentId !== undefined) {
      if (!studentId) {
        return NextResponse.json(
          { success: false, error: '关联学员ID不能为空' },
          { status: 400 },
        );
      }
      data.studentId = studentId;
    }
    if (studentName !== undefined) {
      data.studentName = studentName === '' ? null : studentName;
    }
    if (className !== undefined) {
      data.className = className === '' ? null : className;
    }
    if (classLogId !== undefined) {
      data.classLogId = classLogId === '' ? null : classLogId;
    }
    if (category !== undefined) {
      data.category = category === '' ? null : category;
    }
    if (coverImage !== undefined) {
      data.coverImage = coverImage === '' ? null : coverImage;
    }
    if (linkUrl !== undefined) {
      data.linkUrl = linkUrl === '' ? null : linkUrl;
    }
    if (description !== undefined) {
      data.description = description === '' ? null : description;
    }
    if (techStack !== undefined) {
      const arr = Array.isArray(techStack) ? techStack : [];
      data.techStackJson = JSON.stringify(arr);
    }
    if (featured !== undefined && featured !== null) {
      if (featured === '') {
        data.featured = 0;
      } else {
        const f = Number(featured);
        if (!Number.isNaN(f)) data.featured = f === 1 ? 1 : 0;
      }
    }
    if (sortOrder !== undefined && sortOrder !== null) {
      if (sortOrder === '') {
        data.sortOrder = 0;
      } else {
        const n = Number(sortOrder);
        if (!Number.isNaN(n)) data.sortOrder = n;
      }
    }
    if (status !== undefined && status !== null && status !== '') {
      data.status = status;
      data.reviewedAt = new Date().toISOString();
      data.reviewedBy = 'admin';
    }
    if (reviewNote !== undefined) {
      data.reviewNote = reviewNote === '' ? null : reviewNote;
    }

    await db.campWork.update({ where: { id }, data });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/works/:id PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: '更新作品失败' },
      { status: 500 },
    );
  }
});

// DELETE /api/admin/camp/works/:id
export const DELETE = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campWork.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '作品不存在' },
        { status: 404 },
      );
    }

    await db.campWork.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/works/:id DELETE] error:', error);
    return NextResponse.json(
      { success: false, error: '删除作品失败' },
      { status: 500 },
    );
  }
});
