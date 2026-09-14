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
    // 创作记录 / 能力评估 / 老师点评 —— 结构化返回给详情页。
    // 公开端点不暴露原始 JSON 字符串，而是解析成对象/数组，前端直接消费。
    processLog: parseProcessLog(row.processLogJson),
    ability: parseAbility(row.abilityJson),
    teacherComment: row.teacherComment || '',
  };
}

// 创作记录 JSON 数组：只保留合法条目，字段缺省时给空串，避免前端渲染崩。
function parseProcessLog(str: string | null | undefined): Array<{
  time: string;
  tag: string;
  image: string;
  title: string;
  description: string;
}> {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it === 'object')
      .map((it) => ({
        time: typeof it.time === 'string' ? it.time : '',
        tag: typeof it.tag === 'string' ? it.tag : '',
        image: typeof it.image === 'string' ? it.image : '',
        title: typeof it.title === 'string' ? it.title : '',
        description: typeof it.description === 'string' ? it.description : '',
      }));
  } catch {
    return [];
  }
}

// 能力评估对象：{heading, intro, note, scores:[5]}。
// scores 固定 5 维，非法则回退空对象，由前端判断是否展示雷达图。
function parseAbility(str: string | null | undefined): {
  heading: string;
  intro: string;
  note: string;
  scores: number[];
} | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== 'object') return null;
    const scores = Array.isArray(parsed.scores)
      ? parsed.scores
          .map((n: unknown) => (typeof n === 'number' && !Number.isNaN(n) ? n : 0))
          .slice(0, 5)
      : [];
    return {
      heading: typeof parsed.heading === 'string' ? parsed.heading : '',
      intro: typeof parsed.intro === 'string' ? parsed.intro : '',
      note: typeof parsed.note === 'string' ? parsed.note : '',
      scores,
    };
  } catch {
    return null;
  }
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
