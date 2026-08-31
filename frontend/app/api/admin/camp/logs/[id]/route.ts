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

function transformClassLog(row: any): any {
  return {
    ...row,
    studentIds: safeJsonParse(row.studentIdsJson),
    highlights: safeJsonParse(row.highlightsJson),
    issues: safeJsonParse(row.issuesJson),
  };
}

// GET /api/admin/camp/logs/:id
export const GET = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const log = await db.campClassLog.findUnique({ where: { id } });

    if (!log) {
      return NextResponse.json(
        { success: false, error: '课堂记录不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: transformClassLog(log) });
  } catch (error) {
    console.error('[camp/logs/:id GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取课堂记录详情失败' },
      { status: 500 },
    );
  }
});

// PATCH /api/admin/camp/logs/:id
export const PATCH = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campClassLog.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '课堂记录不存在' },
        { status: 404 },
      );
    }

    const body = await req.json();
    const {
      classDate,
      className,
      teacherName,
      topic,
      durationMin,
      studentIds,
      summary,
      highlights,
      issues,
      nextPlan,
    } = body;

    const data: any = {
      updatedAt: new Date().toISOString(),
    };

    if (classDate !== undefined) {
      if (!classDate) {
        return NextResponse.json(
          { success: false, error: '上课日期不能为空' },
          { status: 400 },
        );
      }
      data.classDate = classDate;
    }
    if (className !== undefined) {
      if (!className) {
        return NextResponse.json(
          { success: false, error: '班级不能为空' },
          { status: 400 },
        );
      }
      data.className = className;
    }
    if (teacherName !== undefined) {
      if (!teacherName) {
        return NextResponse.json(
          { success: false, error: '老师姓名不能为空' },
          { status: 400 },
        );
      }
      data.teacherName = teacherName;
    }
    if (topic !== undefined) {
      if (!topic) {
        return NextResponse.json(
          { success: false, error: '课题不能为空' },
          { status: 400 },
        );
      }
      data.topic = topic;
    }
    if (durationMin !== undefined && durationMin !== null) {
      if (durationMin === '') {
        data.durationMin = null;
      } else {
        const n = Number(durationMin);
        if (!Number.isNaN(n)) data.durationMin = n;
      }
    }
    if (studentIds !== undefined) {
      const arr = Array.isArray(studentIds) ? studentIds : [];
      data.studentIdsJson = JSON.stringify(arr);
    }
    if (summary !== undefined) {
      data.summary = summary === '' ? null : summary;
    }
    if (highlights !== undefined) {
      const arr = Array.isArray(highlights) ? highlights : [];
      data.highlightsJson = JSON.stringify(arr);
    }
    if (issues !== undefined) {
      const arr = Array.isArray(issues) ? issues : [];
      data.issuesJson = JSON.stringify(arr);
    }
    if (nextPlan !== undefined) {
      data.nextPlan = nextPlan === '' ? null : nextPlan;
    }

    await db.campClassLog.update({ where: { id }, data });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/logs/:id PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: '更新课堂记录失败' },
      { status: 500 },
    );
  }
});

// DELETE /api/admin/camp/logs/:id
export const DELETE = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const existing = await db.campClassLog.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '课堂记录不存在' },
        { status: 404 },
      );
    }

    await db.campClassLog.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[camp/logs/:id DELETE] error:', error);
    return NextResponse.json(
      { success: false, error: '删除课堂记录失败' },
      { status: 500 },
    );
  }
});
