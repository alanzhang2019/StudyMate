import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db, getDb } from '@/lib/db';
import {
  checkRateLimit,
  getClientIp,
  RateLimitedError,
} from '@/lib/integrations/rate-limit';
import { saveHtmlFile, runWorkAutoGen } from '@/lib/server/camp-work-autogen';

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

// 同步生成介绍 + 封面（LLM + chromium 截图）可能耗时数十秒，放宽超时
export const maxDuration = 90;

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
// 支持 JSON 与 multipart/form-data（后者可带 htmlFile 文件）。
// 入库即 status = 'pending'；返回编辑链接（editUrl）供学生二次修改。
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

    // 归一化解析：multipart 与 JSON 都解析成 fields + 可选 htmlFile
    const contentType = req.headers.get('content-type') || '';
    const fields: Record<string, string> = {};
    let htmlFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      for (const [k, v] of formData.entries()) {
        if (typeof v === 'string') fields[k] = v;
        else if (k === 'htmlFile') htmlFile = v as File;
      }
    } else {
      const json = await req.json().catch(() => ({} as Record<string, any>));
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === 'string') fields[k] = v;
      }
    }

    // 蜜罐：机器人常填的隐藏字段，命中则静默返回成功但不入库
    if (typeof fields.company === 'string' && fields.company.trim() !== '') {
      return NextResponse.json({ success: true, data: { id: null } });
    }

    const title = typeof fields.title === 'string' ? fields.title.trim() : '';
    const studentName =
      typeof fields.studentName === 'string' ? fields.studentName.trim() : '';

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

    const className = safeStr(fields.className, 40);
    const categoryRaw = safeStr(fields.category, 20);
    const ALLOWED_CAT = ['作品', '项目', '代码', '其他'];
    const category = ALLOWED_CAT.includes(categoryRaw) ? categoryRaw : '作品';

    // 年级：可选。一/二/三/四/五/六年级 + 「不便透露」作默认。
    const GRADE_OPTIONS = [
      '一年级',
      '二年级',
      '三年级',
      '四年级',
      '五年级',
      '六年级',
      '不便透露',
    ];
    const gradeRaw = safeStr(fields.grade, 20);
    const grade = GRADE_OPTIONS.includes(gradeRaw) ? gradeRaw : '不便透露';

    const coverImage = safeStr(fields.coverImage, 500);
    const linkUrl = safeStr(fields.linkUrl, 500);
    const description = safeStr(fields.description, 2000);

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
    const tsRaw = fields.techStack;
    if (typeof tsRaw === 'string') {
      techStack = tsRaw
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((t) => t.slice(0, 40));
    }

    // 先定 id 与 editToken，再落盘 HTML（文件名依赖 id）
    const id = randomUUID();
    const editToken = randomUUID();

    let htmlFileRel: string | null = null;
    if (htmlFile) {
      const name = htmlFile.name || '';
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!['html', 'htm'].includes(ext)) {
        return NextResponse.json(
          { success: false, error: '请上传 .html 格式的作品文件' },
          { status: 400 },
        );
      }
      if (htmlFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'HTML 文件不能超过 5MB' },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await htmlFile.arrayBuffer());
      htmlFileRel = saveHtmlFile(id, buf);
    }

    const created = await db.campWork.create({
      data: {
        id,
        title,
        studentId: null,
        studentName,
        className: className || null,
        grade,
        category,
        coverImage: coverImage || null,
        linkUrl: linkUrl || null,
        description: description || null,
        techStackJson: JSON.stringify(techStack),
        htmlFile: htmlFileRel,
        editToken,
        coverSource: coverImage ? 'url' : 'none',
        status: 'pending',
      },
    });

    // 同步自动生成介绍 + 封面（学生上传 HTML 后，当场拿到结果填回表单）
    let autoDescription: string | null = null;
    let autoCoverImage: string | null = null;
    let autoCoverSource: string | null = null;
    if (htmlFileRel) {
      await runWorkAutoGen(id).catch((e) =>
        console.error('[camp/works autogen] unexpected error:', e),
      );
      const fresh = getDb()
        .prepare(
          'SELECT description, coverImage, coverSource FROM camp_works WHERE id = ?',
        )
        .get(id) as any;
      if (fresh) {
        autoDescription = fresh.description || null;
        autoCoverImage = fresh.coverImage || null;
        autoCoverSource = fresh.coverSource || null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        editToken,
        editUrl: `/camp/works/edit/${editToken}`,
        description: autoDescription,
        coverImage: autoCoverImage,
        coverSource: autoCoverSource,
      },
    });
  } catch (error: any) {
    console.error('[camp/works public POST] error:', error);
    return NextResponse.json(
      { success: false, error: `提交失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
