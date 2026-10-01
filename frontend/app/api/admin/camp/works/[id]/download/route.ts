import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import JSZip from 'jszip';
import { getDb } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';
import {
  collectWorkAssets,
  contentDisposition,
  safeFileStem,
} from '@/lib/server/camp-work-files';

// GET /api/admin/camp/works/:id/download
//   不带参数        → 打包该作品全部源文件为 zip
//   带 ?i=<序号>    → 下载第 i 个文件（序号取自 /files 返回的 i）
// 仅管理员可用；不看审核状态，待审核作品也能下载（审核本来就需要打开源文件）。
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        return NextResponse.json(
          { success: false, error: '非法作品ID' },
          { status: 400 },
        );
      }

      const assets = collectWorkAssets(id);
      if (assets.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: '该作品没有可下载的源文件（可能是纯外链作品，或文件未落盘）',
          },
          { status: 404 },
        );
      }

      const idxRaw = new URL(req.url).searchParams.get('i');

      // ---- 单文件下载 ----
      if (idxRaw !== null && idxRaw !== '') {
        const idx = Number(idxRaw);
        if (!Number.isInteger(idx) || idx < 0 || idx >= assets.length) {
          return NextResponse.json(
            { success: false, error: '文件序号无效' },
            { status: 400 },
          );
        }
        const asset = assets[idx];
        const buf = readFileSync(asset.absPath);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': contentDisposition(asset.fileName),
            'Content-Length': String(buf.length),
            'Cache-Control': 'no-store',
          },
        });
      }

      // ---- 打包下载 ----
      const row = getDb()
        .prepare(
          'SELECT id, title, studentName, className, grade, category, linkUrl, createdAt FROM camp_works WHERE id = ? LIMIT 1',
        )
        .get(id) as any;

      const stem = safeFileStem(row?.title, id);
      const zip = new JSZip();

      const meta = [
        `作品标题：${row?.title || ''}`,
        `学员：${row?.studentName || '—'}`,
        `班级：${row?.className || '—'}`,
        `年级：${row?.grade || '—'}`,
        `分类：${row?.category || '—'}`,
        `外链：${row?.linkUrl || '—'}`,
        `提交时间：${row?.createdAt || '—'}`,
        '',
        '包含文件：',
        ...assets.map((a) => `  - ${a.fileName}  （${a.label}）`),
      ].join('\n');
      zip.file('作品信息.txt', meta);

      for (const a of assets) {
        const buf = readFileSync(a.absPath);
        // 视频本身已是压缩格式，再 deflate 只浪费 CPU，直接存储
        zip.file(a.fileName, buf, {
          compression: a.kind === 'video' ? 'STORE' : 'DEFLATE',
        });
      }

      const out = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      const zipName = `${stem}-源文件包.zip`;

      return new NextResponse(new Uint8Array(out), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': contentDisposition(zipName),
          'Content-Length': String(out.length),
          'Cache-Control': 'no-store',
        },
      });
    } catch (e: any) {
      console.error('[admin/camp/works/:id/download] error:', e);
      return NextResponse.json(
        { success: false, error: `下载失败：${e?.message || '未知错误'}` },
        { status: 500 },
      );
    }
  },
);
