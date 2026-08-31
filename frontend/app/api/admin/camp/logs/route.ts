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

function transformClassLog(row: any): any {
  return {
    ...row,
    studentIds: safeJsonParse(row.studentIdsJson),
    highlights: safeJsonParse(row.highlightsJson),
    issues: safeJsonParse(row.issuesJson),
  };
}

// GET /api/admin/camp/logs：课堂记录列表
// query：className?。默认按 classDate desc, createdAt desc
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const className = url.searchParams.get('className')?.trim();

    const whereSql: string[] = [];
    const params: any[] = [];

    if (className) {
      whereSql.push('className = ?');
      params.push(className);
    }

    let sql = 'SELECT * FROM camp_class_logs';
    if (whereSql.length > 0) {
      sql += ` WHERE ${whereSql.join(' AND ')}`;
    }
    sql += ' ORDER BY classDate DESC, createdAt DESC';

    const rawRows = getDb().prepare(sql).all(...params) as any[];
    const logs = rawRows.map(transformClassLog);

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('[camp/logs GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取课堂记录列表失败' },
      { status: 500 },
    );
  }
});

// POST /api/admin/camp/logs：创建课堂记录
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
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

    if (!classDate || !className || !teacherName || !topic) {
      return NextResponse.json(
        { success: false, error: '上课日期、班级、老师姓名、课题均为必填项' },
        { status: 400 },
      );
    }

    const studentIdsArr = Array.isArray(studentIds) ? studentIds : [];
    const highlightsArr = Array.isArray(highlights) ? highlights : [];
    const issuesArr = Array.isArray(issues) ? issues : [];

    const data: any = {
      classDate,
      className,
      teacherName,
      topic,
      studentIdsJson: JSON.stringify(studentIdsArr),
      highlightsJson: JSON.stringify(highlightsArr),
      issuesJson: JSON.stringify(issuesArr),
    };

    if (durationMin !== undefined && durationMin !== null && durationMin !== '') {
      data.durationMin = Number(durationMin);
    }
    if (summary !== undefined && summary !== null && summary !== '') {
      data.summary = summary;
    }
    if (nextPlan !== undefined && nextPlan !== null && nextPlan !== '') {
      data.nextPlan = nextPlan;
    }

    const created = await db.campClassLog.create({ data });

    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error) {
    console.error('[camp/logs POST] error:', error);
    return NextResponse.json(
      { success: false, error: '创建课堂记录失败' },
      { status: 500 },
    );
  }
});
