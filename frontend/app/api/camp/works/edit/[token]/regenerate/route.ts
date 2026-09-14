import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  readHtmlContent,
  extractTextFromHtml,
  generateDescription,
  generateCover,
} from '@/lib/server/camp-work-autogen';

export const maxDuration = 60;

// POST /api/camp/works/edit/:token/regenerate —— 学生手动重新生成介绍或封面
// body: { kind: 'description' | 'cover' }
export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) => {
  try {
    const { token } = await params;
    const work = await db.campWork.findUnique({ where: { editToken: token } });
    if (!work) {
      return NextResponse.json(
        { success: false, error: '编辑链接无效或已失效' },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({} as Record<string, any>));
    const kind = body.kind;

    if (kind === 'description') {
      let text = '';
      if (work.htmlFile) {
        try {
          text = extractTextFromHtml(readHtmlContent(work.htmlFile));
        } catch (e: any) {
          console.warn('[regenerate] readHtml failed:', e?.message);
        }
      } else if (work.linkUrl) {
        text = `作品外链地址：${work.linkUrl}`;
      }
      const desc = await generateDescription(work.title || '我的作品', text);
      if (!desc) {
        return NextResponse.json(
          { success: false, error: '介绍生成失败，请稍后重试' },
          { status: 500 },
        );
      }
      await db.campWork.update({
        where: { id: work.id },
        data: { description: desc },
      });
      return NextResponse.json({ success: true, data: { description: desc } });
    }

    if (kind === 'cover') {
      const gen = await generateCover(
        work.id,
        work.title || '我的作品',
        work.description || '',
        work.htmlFile,
        work.linkUrl,
      );
      if (!gen) {
        return NextResponse.json(
          { success: false, error: '封面生成失败（可能未安装截图服务）' },
          { status: 500 },
        );
      }
      await db.campWork.update({
        where: { id: work.id },
        data: { coverImage: gen.coverImage, coverSource: gen.coverSource },
      });
      return NextResponse.json({ success: true, data: gen });
    }

    return NextResponse.json(
      { success: false, error: '未知的生成类型' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('[camp/works/edit/regenerate POST] error:', error);
    return NextResponse.json(
      { success: false, error: `生成失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
