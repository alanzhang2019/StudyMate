import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readHtmlContent } from '@/lib/server/camp-work-autogen';
import { injectSpeechShim } from '@/lib/server/camp-speech-shim';
import { asrAvailable } from '@/lib/server/camp-asr';
import { verifyAdminToken } from '@/lib/admin/auth';

// GET /api/camp/works/:id/html —— 返回作品 HTML 文件（新窗口打开）
// 游客仅可查看「已通过」的作品；带有效 admin_token 的管理员不受状态限制，
// 否则待审核作品在审核前根本打不开，审核流程就断了。
//
// 关于安全策略（重要）：
//   响应头统一在 next.config.ts 的 headers() 里声明（见 /api/camp/works/:id/html 规则），
//   **不要在这里再写 Content-Security-Policy** —— Next 对同名响应头是「已有则跳过」，
//   在路由里写的会被全局规则无声丢弃，结果就是「以为加了 sandbox，其实等于裸奔」。
//   现在这条路径的策略是：不做沙箱隔离（学生作品要用到麦克风、localStorage 等能力），
//   改用 Permissions-Policy 显式放行麦克风/摄像头，作品由老师审核通过后才对外可见。
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

    let html = readHtmlContent(row.htmlFile);

    // 语音识别兜底：Chrome 的 webkitSpeechRecognition 走 Google 服务，国内必然
    // network 失败。服务端配了 ASR 时注入包装器，原生失败自动切平台自有识别。
    // ?noshim=1 可临时关闭，便于排查作品本身的问题。
    const disableShim = req.nextUrl.searchParams.get('noshim') === '1';
    if (!disableShim) {
      html = injectSpeechShim(html, { enabled: asrAvailable() });
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
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
