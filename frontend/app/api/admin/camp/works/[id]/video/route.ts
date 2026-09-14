import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';
import { mkdirSync, createWriteStream } from 'fs';
import { Readable } from 'stream';
import {
  videoDir,
  videoFilePath,
  videoServeUrl,
} from '@/lib/server/camp-work-autogen';

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXT = ['mp4', 'webm', 'mov', 'm4v'];

// 大文件上传可能耗时较久，放宽超时。
export const maxDuration = 120;

// POST /api/admin/camp/works/:id/video
// 老师后台上传作品介绍视频（multipart，字段名 video）。
// 流式落盘到 camp-videos/<id>.<ext>，并把 introVideoFile 写成服务 URL。
// 优先用流式写入，避免把 200MB 整文件读进内存。
export const POST = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      // 防穿越：workId 必须形如 UUID
      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        return NextResponse.json({ success: false, error: '非法作品ID' }, { status: 400 });
      }

      const existing = await db.campWork.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ success: false, error: '作品不存在' }, { status: 404 });
      }

      const form = await req.formData();
      const file = form.get('video') as File | null;
      if (!file || typeof file === 'string') {
        return NextResponse.json({ success: false, error: '请选择视频文件' }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, error: '视频文件为空' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ success: false, error: '视频不能超过 200MB' }, { status: 400 });
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        return NextResponse.json(
          { success: false, error: '仅支持 mp4 / webm / mov / m4v 格式' },
          { status: 400 },
        );
      }

      mkdirSync(videoDir(), { recursive: true });
      const dest = videoFilePath(id, ext);

      // 流式写入：Web ReadableStream → Node Readable → WriteStream
      await new Promise<void>((resolve, reject) => {
        const ws = createWriteStream(dest);
        Readable.fromWeb(file.stream() as any).pipe(ws);
        ws.on('finish', () => resolve());
        ws.on('error', reject);
      });

      const url = videoServeUrl(id, ext);
      await db.campWork.update({
        where: { id },
        data: { introVideoFile: url, updatedAt: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, data: { url } });
    } catch (e: any) {
      console.error('[camp/works/:id/video] error:', e);
      return NextResponse.json(
        { success: false, error: `上传失败：${e?.message || '未知错误'}` },
        { status: 500 },
      );
    }
  },
);
