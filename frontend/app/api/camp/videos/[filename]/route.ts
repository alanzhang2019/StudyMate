import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { Readable } from 'stream';
import { videoFilePath } from '@/lib/server/camp-work-autogen';

const EXT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
};

// GET /api/camp/videos/:filename —— 返回落盘的作品介绍视频（老师后台上传）。
// 与 covers 路由一致：严格白名单 + 防路径穿越，文件不存在即 404。
//
// ⚠️ 与 covers 路由的关键差别：视频必须支持 HTTP Range。
// 封面图只有几百 KB，readFileSync 一把返回没问题；但作品介绍视频
// 动辄几十上百 MB（上传时已压到 720p/2.5Mbps，4 分钟仍约 80MB），
// 必须做到两件事：
//   1) 流式响应，不把整个文件读进内存 —— 否则几个人同时看就会把
//      Node 进程的内存吃满（原来是 readFileSync(p)，是明确的隐患）；
//   2) 正确响应 Range 请求 —— 这是「拖动进度条」的前提。
//      原来声明了 Accept-Ranges: bytes 却无视 Range 头、永远返回 200 全量，
//      导致浏览器每次拖动都只能从头重新下载，进度条拖不动。
// 这里按 RFC 7233 实现：带 Range 返 206 + Content-Range，
// 不带则返 200 + 全量流，并始终带上 Accept-Ranges: bytes。
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) => {
  try {
    const { filename } = await params;
    // 严格白名单，杜绝路径穿越
    if (!/^[a-zA-Z0-9-]+\.(mp4|webm|mov|m4v)$/.test(filename)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const [base, rawExt] = filename.split('.');
    const ext = rawExt.toLowerCase();
    const p = videoFilePath(base, ext);
    if (!existsSync(p)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }

    const size = statSync(p).size;
    const contentType = EXT_TYPES[ext] || 'video/mp4';

    // 不缓存文件内容之外的东西；视频内容不可变（文件名即作品 id，换片会换 URL）
    const baseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    const rangeHeader = req.headers.get('range');
    if (!rangeHeader) {
      // 无 Range：返回全量流式响应
      const stream = createReadStream(p);
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(size) },
      });
    }

    // 解析 Range。只支持单段 "bytes=start-end" 形式（浏览器播放器都是这种）。
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m) {
      // 语法不认识 → 按 RFC 7233 应返回 416，并告知当前可用范围
      return new NextResponse(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
      });
    }

    const [, startRaw, endRaw] = m;
    let start: number;
    let end: number;
    if (startRaw === '') {
      // "bytes=-N"：最后 N 字节
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
    const stream = createReadStream(p, { start, end });
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
