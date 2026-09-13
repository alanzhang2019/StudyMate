import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  saveHtmlFile,
  readHtmlContent,
  extractTextFromHtml,
  generateDescription,
  generateCover,
} from '@/lib/server/camp-work-autogen';

export const maxDuration = 90;

// POST /api/camp/works/edit/:token/upload-html
// 学生上传或替换 HTML 作品；同步抽取文本 → 生成介绍 → 生成封面 → 写库。
// 失败仅记日志，不阻塞；最终返回最新 description/coverImage/coverSource，让前端
// 拿到结果后直接填回表单，无需「再点一次」的二次确认。
//
// 可选 multipart 字段：htmlFile(.html/.htm)；
// 当未传 htmlFile 且作品已有 htmlFile 时，等价于「重新基于现有 HTML 生成」。
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

    const ALLOWED_HTML_EXT = ['html', 'htm'];
    let htmlFileRel: string | null = work.htmlFile || null;

    let formData: FormData | null = null;
    try {
      formData = await req.formData();
    } catch {
      /* no body */
    }
    if (formData) {
      const htmlFile = formData.get('htmlFile');
      if (htmlFile && typeof htmlFile !== 'string') {
        const file = htmlFile as File;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_HTML_EXT.includes(ext)) {
          return NextResponse.json(
            { success: false, error: '请上传 .html 格式的作品文件' },
            { status: 400 },
          );
        }
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: 'HTML 文件不能超过 5MB' },
            { status: 400 },
          );
        }
        const buf = Buffer.from(await file.arrayBuffer());
        htmlFileRel = saveHtmlFile(work.id, buf);
        await db.campWork.update({
          where: { id: work.id },
          data: { htmlFile: htmlFileRel, updatedAt: new Date().toISOString() },
        });
      }
    }

    if (!htmlFileRel) {
      return NextResponse.json(
        { success: false, error: '请先上传 .html 作品文件' },
        { status: 400 },
      );
    }

    const title = work.title || '我的作品';

    // 1. 抽文本
    let text = '';
    try {
      text = extractTextFromHtml(readHtmlContent(htmlFileRel));
    } catch (e: any) {
      console.warn('[upload-html] readHtml failed:', e?.message);
    }

    // 2. 生成介绍（学生已有手写介绍时不动）
    let description = work.description || '';
    let descriptionGenerated = false;
    if (!description) {
      const desc = await generateDescription(title, text);
      if (desc) {
        description = desc;
        descriptionGenerated = true;
      }
    }

    // 3. 生成封面（学生已有 coverImage 时不动；默认作品截图，回退 AI 插画）
    let coverImage = work.coverImage || '';
    let coverSource = work.coverSource || 'none';
    let coverGenerated = false;
    let coverError: string | null = null;
    if (!coverImage) {
      const gen = await generateCover(work.id, title, description, htmlFileRel);
      if (gen) {
        coverImage = gen.coverImage;
        coverSource = gen.coverSource;
        coverGenerated = true;
      } else {
        coverError = '封面生成失败（可能未安装截图服务），你可以上传自己画的封面';
      }
    }

    // 4. 写库
    const data: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (descriptionGenerated) data.description = description;
    if (coverGenerated) {
      data.coverImage = coverImage;
      data.coverSource = coverSource;
    }
    if (Object.keys(data).length > 1) {
      await db.campWork.update({ where: { id: work.id }, data });
    }

    const updated = await db.campWork.findUnique({ where: { id: work.id } });
    return NextResponse.json({
      success: true,
      data: {
        description: updated?.description || description,
        coverImage: updated?.coverImage || '',
        coverSource: updated?.coverSource || 'none',
        hasHtml: !!updated?.htmlFile,
        descriptionGenerated,
        coverGenerated,
        coverError,
      },
    });
  } catch (error: any) {
    console.error('[camp/works/edit/upload-html POST] error:', error);
    return NextResponse.json(
      { success: false, error: `上传失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
