import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readHtmlContent } from '@/lib/server/camp-work-autogen';

// GET /api/camp/works/:id/html —— 返回已审核作品的 HTML 文件（新窗口打开）
// 用 CSP sandbox 隔离脚本：允许脚本运行（展示交互），但不 allow-same-origin，
// 脚本运行在 opaque origin，无法访问本站 cookie/storage 或父窗口。
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const row = getDb()
      .prepare('SELECT status, htmlFile FROM camp_works WHERE id = ? LIMIT 1')
      .get(id) as any;

    if (!row || row.status !== 'approved' || !row.htmlFile) {
      return NextResponse.json(
        { success: false, error: 'not found' },
        { status: 404 },
      );
    }

    const html = readHtmlContent(row.htmlFile);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': 'sandbox allow-scripts',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'not found' },
      { status: 404 },
    );
  }
};
