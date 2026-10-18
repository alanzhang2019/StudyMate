import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';
import { saveHtmlFile } from '@/lib/server/camp-work-autogen';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB（学生端限制是 5MB，老师补新版本放宽一倍）
const ALLOWED_EXT = ['html', 'htm'];

// POST /api/admin/camp/works/:id/html
// 老师后台替换学生作品的 HTML 源文件（multipart，字段名 htmlFile）。
//
// 落盘路径与学生端提交时完全一致：camp-uploads/<id>.html —— 直接覆盖旧版本，
// 所以预览（/api/camp/works/:id/html）、源文件清单、打包下载三条链路都无需改动。
// 学生端原本就能改（edit/[token] 的 PATCH 与 upload-html），缺的只是管理端入口。
export const POST = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      // 防穿越：workId 必须形如 UUID（与 video / image 路由同一套校验）
      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        return NextResponse.json({ success: false, error: '非法作品ID' }, { status: 400 });
      }

      const existing = await db.campWork.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ success: false, error: '作品不存在' }, { status: 404 });
      }

      const form = await req.formData();
      const file = form.get('htmlFile') as File | null;
      if (!file || typeof file === 'string') {
        return NextResponse.json({ success: false, error: '请选择 HTML 文件' }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, error: '文件为空' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { success: false, error: 'HTML 文件不能超过 10MB' },
          { status: 400 },
        );
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        return NextResponse.json(
          { success: false, error: '仅支持 .html / .htm 文件' },
          { status: 400 },
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const rel = saveHtmlFile(id, buf);

      await db.campWork.update({
        where: { id },
        data: { htmlFile: rel, updatedAt: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        data: { htmlFile: rel, size: buf.length },
      });
    } catch (e: any) {
      console.error('[admin/camp/works/:id/html] error:', e);
      return NextResponse.json(
        { success: false, error: `替换失败：${e?.message || '未知错误'}` },
        { status: 500 },
      );
    }
  },
);
