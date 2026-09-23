import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { db, getDb } from '@/lib/db';
import {
  checkRateLimit,
  getClientIp,
  RateLimitedError,
} from '@/lib/integrations/rate-limit';

export const dynamic = 'force-dynamic';
// 上传可能含较大文件，放宽超时
export const maxDuration = 60;

// 文件落盘根目录：沿用 db.ts / camp-work-autogen 的 DATA_DIR 约定
// （生产 = /app/data 持久命名卷，重建容器不丢）
const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';
const CLIPBOARD_DIR = path.join(DATA_DIR, 'clipboard');

const ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv',
  'json', 'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'zip',
  'rar', '7z', 'mp3', 'mp4', 'mov', 'webm', 'm4a', 'wav', 'pages', 'key',
  'numbers',
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_TEXT_CHARS = 8000;

/** 房间码：只允许小写字母/数字/连字符，最长 20 位，空则落到公共板 */
function sanitizeRoom(raw: string | null | undefined): string {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return 'public';
  const cleaned = s.replace(/[^a-z0-9-]/g, '').slice(0, 20);
  return cleaned || 'public';
}

/** 文件名去危险字符，最长 120 位 */
function safeName(raw: string | null | undefined): string {
  const s = (raw || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  return s || 'file';
}

/** 把内部行转换成对外安全字段（文件内容不回传，文本截断预览） */
function toPublic(row: any) {
  return {
    id: row.id,
    room: row.room,
    type: row.type,
    title: row.title,
    fileName: row.fileName ?? null,
    fileSize: row.fileSize ?? null,
    mimeType: row.mimeType ?? null,
    content: row.type === 'text' ? String(row.content || '').slice(0, 2000) : null,
    author: row.author,
    createdAt: row.createdAt,
    downloadUrl: row.type === 'file' ? `/api/clipboard/${row.id}/file` : null,
  };
}

// GET /api/clipboard?room=xxx —— 列出某房间最新的剪贴项（公开，无需登录）
export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const room = sanitizeRoom(url.searchParams.get('room'));
    const rows = getDb()
      .prepare(
        'SELECT * FROM clipboard_items WHERE room = ? ORDER BY createdAt DESC LIMIT 300',
      )
      .all(room) as any[];
    return NextResponse.json({ success: true, data: rows.map(toPublic) });
  } catch (error: any) {
    console.error('[clipboard GET] error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
};

// POST /api/clipboard —— 上传文件或文本到指定房间（公开，无需登录）
// multipart/form-data：fields.room / fields.author / fields.title / file(File)
// 或 application/json：{ room, author, content, title }
// 防护：单 IP 10 分钟最多 30 次 + 文件大小/类型白名单。
export const POST = async (req: NextRequest) => {
  try {
    const ip = getClientIp(req.headers);
    try {
      checkRateLimit(`clipboard-post:${ip}`, 30, 10 * 60_000);
    } catch (err) {
      if (err instanceof RateLimitedError) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'RATE_LIMITED',
            error: '操作太频繁，请稍后再试',
            retryAfter: err.retryAfterSec,
          },
          { status: 429 },
        );
      }
      throw err;
    }

    const contentType = req.headers.get('content-type') || '';
    const fields: Record<string, string> = {};
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === 'string') fields[k] = v;
        else if (k === 'file') file = v as File;
      }
    } else {
      const json = await req.json().catch(() => ({} as Record<string, any>));
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === 'string') fields[k] = v;
      }
    }

    const room = sanitizeRoom(fields.room);
    const author = (fields.author || '').trim().slice(0, 40) || '匿名';

    // ---- 文件类 ----
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: '单个文件不能超过 20MB' },
          { status: 400 },
        );
      }
      const origName = safeName(file.name);
      const ext = (origName.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          { success: false, error: '暂不支持该文件类型' },
          { status: 400 },
        );
      }
      const id = randomUUID();
      const storedName = `${id}.${ext}`;
      const absDir = path.join(CLIPBOARD_DIR, room);
      mkdirSync(absDir, { recursive: true });
      const absPath = path.join(absDir, storedName);
      const buf = Buffer.from(await file.arrayBuffer());
      writeFileSync(absPath, buf);

      const created = db.clipboardItem.create({
        data: {
          id,
          room,
          type: 'file',
          title: origName,
          fileName: origName,
          filePath: path.join('clipboard', room, storedName),
          fileSize: buf.length,
          mimeType: file.type || 'application/octet-stream',
          author,
        },
      });
      return NextResponse.json({ success: true, data: toPublic(created) });
    }

    // ---- 文本类 ----
    const content = (fields.content || '').slice(0, MAX_TEXT_CHARS);
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入文本或选择要分享的文件' },
        { status: 400 },
      );
    }
    const id = randomUUID();
    const title =
      (fields.title || content.split('\n')[0] || '').trim().slice(0, 60) ||
      '文本剪贴';
    const created = db.clipboardItem.create({
      data: { id, room, type: 'text', title, content, author },
    });
    return NextResponse.json({ success: true, data: toPublic(created) });
  } catch (error: any) {
    console.error('[clipboard POST] error:', error);
    return NextResponse.json(
      { success: false, error: `提交失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
