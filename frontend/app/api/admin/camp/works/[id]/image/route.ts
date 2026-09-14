import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { coverFilePath } from '@/lib/server/camp-work-autogen';

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

// POST /api/admin/camp/works/:id/image
// 老师后台上传创作记录/过程截图（multipart，字段名 image）。
// 落盘到 camp-covers/<workId>-<uuid>.<ext>，返回 /api/camp/covers/<filename> 服务 URL。
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
      const file = form.get('image') as File | null;
      if (!file || typeof file === 'string') {
        return NextResponse.json({ success: false, error: '请选择图片文件' }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, error: '图片文件为空' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ success: false, error: '图片不能超过 20MB' }, { status: 400 });
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        return NextResponse.json(
          { success: false, error: '仅支持 png / jpg / jpeg / webp / gif 格式' },
          { status: 400 },
        );
      }

      const filename = `${id}-${randomUUID()}.${ext}`;
      const dest = coverFilePath(filename);
      mkdirSync(path.dirname(dest), { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      writeFileSync(dest, buf);

      const url = `/api/camp/covers/${filename}`;
      return NextResponse.json({ success: true, data: { url } });
    } catch (e: any) {
      console.error('[camp/works/:id/image] error:', e);
      return NextResponse.json(
        { success: false, error: `上传失败：${e?.message || '未知错误'}` },
        { status: 500 },
      );
    }
  },
);
