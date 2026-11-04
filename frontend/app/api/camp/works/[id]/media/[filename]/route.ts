import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { Readable } from 'stream';
import { getDb } from '@/lib/db';
import { verifyAdminToken } from '@/lib/admin/auth';
import {
  MEDIA_RULES,
  MEDIA_FILENAME_RE,
  WORK_ID_RE,
  mediaFilePath,
  parseMediaJson,
} from '@/lib/server/camp-work-media';

/**
 * GET /api/camp/works/:id/media/:filename
 *   返回学生上传的非 HTML 作品素材（图片 / 视频 / 文档）。
 *
 * 与 /html 路由保持同一套审核策略：游客只能看 status='approved' 的作品；
 * 管理员（admin_token）不受状态限制，否则待审核作品在审核前根本打不开；
 * 另外允许 ?token=<editToken> 的学生本人预览自己的素材。
 *
 * 三层防越权：
 *   1. workId 必须是 UUID、文件名必须是 <seq>.<ext> 且扩展名在白名单；
 *   2. 该文件名必须确实登记在该作品的 mediaJson 里（防枚举目录其它文件）；
 *   3. 审核状态 / 管理员 / 编辑凭证三选一。
 *
 * 视频必须支持 HTTP Range：浏览器播放器靠 206 + Content-Range 才能拖动
 * 进度条；同时用 createReadStream 流式返回，避免几十 MB 文件一次性进内存。
 * 大图片 / PDF 走同一条流式路径，代码只有一份。
 */
const notFound = () =>
  NextResponse.json({ success: false, error: 'not found' }, { status: 404 });

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> },
) => {
  try {
    const { id, filename } = await params;
    if (!WORK_ID_RE.test(id) || !MEDIA_FILENAME_RE.test(filename)) return notFound();

    const matched = MEDIA_FILENAME_RE.exec(filename)!;
    const seq = Number(matched[1]);
    const ext = matched[2].toLowerCase();
    const rule = MEDIA_RULES[ext];
    if (!rule || seq < 1) return notFound();

    const row = getDb()
      .prepare('SELECT status, editToken, mediaJson FROM camp_works WHERE id = ? LIMIT 1')
      .get(id) as { status: string; editToken: string | null; mediaJson: string | null } | undefined;
    if (!row) return notFound();

    const media = parseMediaJson(row.mediaJson);
    const entry = media.find((m) => m.url.endsWith(`/media/${seq}.${ext}`));
    if (!entry) return notFound();

    const adminToken = req.cookies.get('admin_token')?.value;
    const isAdmin = adminToken ? Boolean(await verifyAdminToken(adminToken)) : false;
    const tokenParam = req.nextUrl.searchParams.get('token');
    const isOwner = !!tokenParam && !!row.editToken && tokenParam === row.editToken;
    if (!isAdmin && !isOwner && row.status !== 'approved') return notFound();

    const p = mediaFilePath(id, seq, ext);
    if (!existsSync(p)) return notFound();
    const size = statSync(p).size;

    // 文档类（非 PDF）强制下载；图片 / 视频 / PDF 内联展示。
    const asAttachment = rule.kind === 'file' && ext !== 'pdf';
    const safeAscii = `${seq}.${ext}`;
    const disposition = asAttachment
      ? `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(
          entry.name || safeAscii,
        )}`
      : 'inline';

    const baseHeaders: Record<string, string> = {
      'Content-Type': entry.mime || rule.mime,
      'Accept-Ranges': 'bytes',
      // 不用 immutable：作品审核状态会变，长缓存会让刚通过的作品仍读到 404
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': disposition,
    };

    const rangeHeader = req.headers.get('range');
    if (!rangeHeader) {
      return new NextResponse(
        Readable.toWeb(createReadStream(p)) as ReadableStream,
        { status: 200, headers: { ...baseHeaders, 'Content-Length': String(size) } },
      );
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
    return new NextResponse(
      Readable.toWeb(createReadStream(p, { start, end })) as ReadableStream,
      {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(chunkSize),
        },
      },
    );
  } catch {
    return notFound();
  }
};
