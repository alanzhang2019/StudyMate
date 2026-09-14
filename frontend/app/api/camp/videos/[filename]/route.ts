import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { videoFilePath, videoDir } from '@/lib/server/camp-work-autogen';

const EXT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
};

// GET /api/camp/videos/:filename —— 返回落盘的作品介绍视频（老师后台上传）。
// 与 covers 路由一致：严格白名单 + 防路径穿越，文件不存在即 404。
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) => {
  try {
    const { filename } = await params;
    // 严格白名单，杜绝路径穿越
    if (!/^[a-zA-Z0-9-]+\.(mp4|webm|mov|m4v)$/.test(filename)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const p = videoFilePath(filename.split('.')[0], filename.split('.').pop()!);
    if (!existsSync(p)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const buf = readFileSync(p);
    const ext = filename.split('.').pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': EXT_TYPES[ext] || 'video/mp4',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'not found' }, { status: 500 });
  }
};
