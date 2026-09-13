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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'not found' }, { status: 500 });
  }
};
