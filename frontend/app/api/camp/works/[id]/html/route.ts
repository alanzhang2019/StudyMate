import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readHtmlContent } from '@/lib/server/camp-work-autogen';
import { verifyAdminToken } from '@/lib/admin/auth';

// GET /api/camp/works/:id/html —— 返回作品 HTML 文件（新窗口打开）
// 游客仅可查看「已通过」的作品；带有效 admin_token 的管理员不受状态限制，
// 否则待审核作品在审核前根本打不开，审核流程就断了。
// 用 CSP sandbox 隔离脚本：允许脚本运行（展示交互），但不 allow-same-origin，
// 脚本运行在 opaque origin，无法访问本站 cookie/storage 或父窗口。
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const row = getDb()
      .prepare('SELECT status, htmlFile FROM camp_works WHERE id = ? LIMIT 1')
      .get(id) as any;

    const adminToken = req.cookies.get('admin_token')?.value;
    const isAdmin = adminToken
      ? Boolean(await verifyAdminToken(adminToken))
      : false;

    if (!row || !row.htmlFile || (!isAdmin && row.status !== 'approved')) {
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
