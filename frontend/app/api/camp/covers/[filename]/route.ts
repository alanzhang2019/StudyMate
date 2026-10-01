import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { coverFilePath } from '@/lib/server/camp-work-autogen';

const EXT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

// GET /api/camp/covers/:filename —— 返回落盘的封面图片（AI 生成 / 学生上传）
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) => {
  try {
    const { filename } = await params;
    // 严格白名单，杜绝路径穿越
    if (!/^[a-zA-Z0-9-]+\.(png|jpe?g|webp|gif)$/.test(filename)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const p = coverFilePath(filename);
    if (!existsSync(p)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const buf = readFileSync(p);
    const ext = filename.split('.').pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': EXT_TYPES[ext] || 'image/png',
        // 注意：封面文件名固定为 <workId>.<ext>，重新生成/学生上传会原地覆盖同名文件。
        // 不能用 max-age=31536000, immutable —— 那会让浏览器一年内都显示旧图
        // （2026-10-01 事故：重新生成封面/上传封面后页面永远显示旧图）。
        // 1 小时兼顾 CDN/浏览器缓存与编辑后生效速度；编辑页另有 ?v= 时间戳兜底。
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'not found' }, { status: 500 });
  }
};
