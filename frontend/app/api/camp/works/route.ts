import { NextRequest, NextResponse } from 'next/server';
import { db, getDb } from '@/lib/db';
import {
  checkRateLimit,
  getClientIp,
  RateLimitedError,
} from '@/lib/integrations/rate-limit';

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

// POST /api/camp/works：学生自助提交作品（无需登录）
// 入库即 status = 'pending'，等待老师在 /admin/camp/works 审核通过后上墙。
// 防护：单 IP 10 分钟内最多 8 次 + 隐藏蜜罐字段拦截机器人。
export const POST = async (req: NextRequest) => {
  try {
    const ip = getClientIp(req.headers);
    try {
      checkRateLimit(`camp-submit:${ip}`, 8, 10 * 60_000);
    } catch (err) {
      if (err instanceof RateLimitedError) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'RATE_LIMITED',
            error: '提交太频繁，请稍后再试',
            retryAfter: err.retryAfterSec,
          },
          { status: 429 },
        );
      }
      throw err;
    }

    const body = await req.json().catch(() => ({} as Record<string, any>));

    // 蜜罐：机器人常填的隐藏字段，命中则静默返回成功但不入库
    if (typeof body.company === 'string' && body.company.trim() !== '') {
      return NextResponse.json({ success: true, data: { id: null } });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const studentName =
      typeof body.studentName === 'string' ? body.studentName.trim() : '';

    if (!title) {
      return NextResponse.json(
        { success: false, error: '请填写作品标题' },
        { status: 400 },
      );
    }
    if (title.length > 120) {
      return NextResponse.json(
        { success: false, error: '作品标题不超过 120 字' },
        { status: 400 },
      );
    }
    if (!studentName) {
      return NextResponse.json(
        { success: false, error: '请填写你的名字' },
        { status: 400 },
      );
    }
    if (studentName.length > 40) {
      return NextResponse.json(
        { success: false, error: '名字不超过 40 字' },
        { status: 400 },
      );
    }

    const safeStr = (v: any, max: number) =>
      typeof v === 'string' ? v.trim().slice(0, max) : '';
    const isUrl = (v: string) => /^https?:\/\/.+/i.test(v);

    const className = safeStr(body.className, 40);
    const categoryRaw = safeStr(body.category, 20);
    const ALLOWED_CAT = ['作品', '项目', '代码', '其他'];
    const category = ALLOWED_CAT.includes(categoryRaw) ? categoryRaw : '作品';
    const coverImage = safeStr(body.coverImage, 500);
    const linkUrl = safeStr(body.linkUrl, 500);
    const description = safeStr(body.description, 2000);

    if (coverImage && !isUrl(coverImage)) {
      return NextResponse.json(
        { success: false, error: '封面图请填写以 http(s) 开头的图片链接' },
        { status: 400 },
      );
    }
    if (linkUrl && !isUrl(linkUrl)) {
      return NextResponse.json(
        { success: false, error: '作品链接请填写以 http(s) 开头的网址' },
        { status: 400 },
      );
    }

    let techStack: string[] = [];
    if (Array.isArray(body.techStack)) {
      techStack = (body.techStack as any[])
        .filter((t) => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((t) => t.slice(0, 40));
    } else if (typeof body.techStack === 'string') {
      techStack = body.techStack
        .split(/[,，\s]+/)
        .map((t: string) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((t: string) => t.slice(0, 40));
    }

    const created = await db.campWork.create({
      data: {
        title,
        studentId: null,
        studentName,
        className: className || null,
        category,
        coverImage: coverImage || null,
        linkUrl: linkUrl || null,
        description: description || null,
        techStackJson: JSON.stringify(techStack),
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error: any) {
    console.error('[camp/works public POST] error:', error);
    return NextResponse.json(
      { success: false, error: `提交失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
