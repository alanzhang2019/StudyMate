import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/clipboard/[id]/file —— 流式返回某文件的二进制内容。
// 与 camp/videos 路由一致：严格校验 id（UUID）+ 防路径穿越 + 支持 HTTP Range。
const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';

// 仅这些类型允许浏览器内联预览；其余（含 html/svg/js/cpp/zip 等）一律强制下载，
// 避免用户上传的 html/svg 在同源下被执行（存储型 XSS）。
const INLINE_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'ico', 'heic',
  'avif', 'mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mp3', 'wav', 'm4a',
  'aac', 'ogg', 'oga', 'flac', 'pdf',
]);

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    // 严格白名单，杜绝路径穿越
    if (!/^[a-f0-9-]{36}$/.test(id)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const row = getDb().prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id) as any;
    if (!row || row.type !== 'file' || !row.filePath) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }

    const abs = path.join(DATA_DIR, row.filePath);
    // 防穿越：解析后必须严格落在 DATA_DIR/clipboard 之下
    const realRoot = path.resolve(DATA_DIR, 'clipboard') + path.sep;
    if (!path.resolve(abs).startsWith(realRoot)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    if (!existsSync(abs)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }

    const size = statSync(abs).size;
    const fileName = row.fileName || 'file';
    const encoded = encodeURIComponent(fileName);
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const disposition = INLINE_EXT.has(ext) ? 'inline' : 'attachment';
    const baseHeaders: Record<string, string> = {
      'Content-Type': row.mimeType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encoded}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=31536000, immutable',
    };

    const rangeHeader = req.headers.get('range');
    if (!rangeHeader) {
      const stream = createReadStream(abs);
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(size) },
      });
    }

    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
      });
    }

    const [, startRaw, endRaw] = m;
    let start: number;
    let end: number;
    if (startRaw === '') {
      const suffixLen = Number(endRaw);
      if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
        });
      }
      start = Math.max(0, size - suffixLen);
      end = size - 1;
    } else {
      start = Number(startRaw);
      end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = createReadStream(abs, { start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkSize),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'not found' }, { status: 500 });
  }
};
