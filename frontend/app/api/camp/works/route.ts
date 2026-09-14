import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { db, getDb } from '@/lib/db';
import { GRADE_OPTIONS } from '@/lib/camp/grades';
import {
  checkRateLimit,
  getClientIp,
  RateLimitedError,
} from '@/lib/integrations/rate-limit';
import {
  saveHtmlFile,
  runWorkAutoGen,
  coverFilePath,
} from '@/lib/server/camp-work-autogen';

/**
 * 把客户端 html2canvas 截图产生的 dataURL 落盘成 PNG 文件。
 * dataURL 形如 `data:image/png;base64,xxxxx`。
 *
 * 关键校验（防止客户端 html2canvas 渲染失败时把空白 PNG 当封面存进 DB）：
 *   1. PNG signature (8 字节) —— 不是合法 PNG 直接拒；
 *   2. 最小尺寸 > 4KB —— 空白画布的 PNG 通常只有几百字节；
 *   3. 路径统一走 coverFilePath —— 跟 covers 路由、chromium 截图、Seedream 插画
 *      共享同一个 DB_DIR/camp-covers，避免 fallback 不一致导致 404。
 */
function saveCoverFromDataUrl(workId: string, dataUrl: string): string | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const base64 = match[1];
  if (base64.length > 8 * 1024 * 1024) return null; // ~6MB 二进制上限保护
  const buf = Buffer.from(base64, 'base64');
  if (buf.length === 0) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length < 8 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47 ||
    buf[4] !== 0x0d ||
    buf[5] !== 0x0a ||
    buf[6] !== 0x1a ||
    buf[7] !== 0x0a
  ) {
    console.warn(`[camp/works] saveCoverFromDataUrl: invalid PNG signature for ${workId}`);
    return null;
  }

  // 文件太小 → 大概率是空白 PNG（html2canvas 渲染失败但仍返回合法 dataURL）
  if (buf.length < 4096) {
    console.warn(
      `[camp/works] saveCoverFromDataUrl: PNG too small (${buf.length} bytes) for ${workId}, refuse`,
    );
    return null;
  }

  // 路径走 coverFilePath，保证跟 chromium / Seedream / covers 路由用同一份 DATA_DIR
  // 落盘前先确保目录存在（coverFilePath 不创建目录）
  const filePath = coverFilePath(`${workId}.png`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, buf);
  return `/api/camp/covers/${workId}.png`;
}

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
    const sort = url.searchParams.get('sort')?.trim();

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

    // 排序：精选永远置顶（这是「精选」的意义所在），同一档内再按请求的方式排。
    // hot  -> 浏览量高者先（viewCount 由详情页 POST /view 累加）
    // 其他 -> 创建时间倒序（默认）
    const orderBy =
      sort === 'hot'
        ? 'featured DESC, sortOrder ASC, viewCount DESC, createdAt DESC'
        : 'featured DESC, sortOrder ASC, createdAt DESC';

    const sql = `SELECT * FROM camp_works WHERE ${whereSql.join(' AND ')} ORDER BY ${orderBy}`;

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

    // 归一化解析：multipart 与 JSON 都解析成 fields + 可选 htmlFile + 可选 coverDataUrl
    const contentType = req.headers.get('content-type') || '';
    const fields: Record<string, string> = {};
    let htmlFile: File | null = null;
    let coverDataUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      for (const [k, v] of formData.entries()) {
        if (typeof v === 'string') fields[k] = v;
        else if (k === 'htmlFile') htmlFile = v as File;
      }
      // coverDataUrl 体积大（base64 ~1-3MB），通常走 multipart
      const cdu = fields.coverDataUrl;
      if (typeof cdu === 'string' && cdu.startsWith('data:image/')) {
        coverDataUrl = cdu;
      }
    } else {
      const json = await req.json().catch(() => ({} as Record<string, any>));
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === 'string') fields[k] = v;
      }
      const cdu = fields.coverDataUrl;
      if (typeof cdu === 'string' && cdu.startsWith('data:image/')) {
        coverDataUrl = cdu;
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

    // 年级：可选。一年级到十二年级 + 「不便透露」作默认。
    const gradeRaw = safeStr(fields.grade, 20);
    const grade = GRADE_OPTIONS.includes(gradeRaw as any) ? gradeRaw : '不便透露';

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
        coverSource: coverImage ? 'url' : coverDataUrl ? 'client' : 'none',
        status: 'pending',
      },
    });

    // 客户端先发来了封面截图（html2canvas 兜底）→ 立刻落盘，写回 coverImage
    let clientCoverImage: string | null = null;
    if (coverDataUrl && !coverImage) {
      const url = saveCoverFromDataUrl(id, coverDataUrl);
      if (url) {
        clientCoverImage = url;
        getDb()
          .prepare(
            'UPDATE camp_works SET coverImage = ?, coverSource = ? WHERE id = ?',
          )
          .run(url, 'client', id);
      }
    }

    // 同步自动生成：介绍（仅在有 HTML 时）、封面（截图回退 AI）、
    // 三块内容「点评/能力/创作记录」（始终尝试，学生没填点评才生成草稿）。
    // runWorkAutoGen 内部会检测已有字段，自动跳过对应步骤，永不抛。
    let autoDescription: string | null = null;
    let autoCoverImage: string | null = null;
    let autoCoverSource: string | null = null;
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
