import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { db } from '@/lib/db';
import {
  coverFilePath,
  saveHtmlFile,
} from '@/lib/server/camp-work-autogen';

const ALLOWED_COVER_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const ALLOWED_HTML_EXT = ['html', 'htm'];

function safeStr(v: any, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// GET /api/camp/works/edit/:token —— 学生凭编辑凭证取回自己的作品（可编辑字段）
export const GET = async (
  _req: NextRequest,
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
    return NextResponse.json({
      success: true,
      data: {
        id: work.id,
        title: work.title,
        studentName: work.studentName,
        grade: work.grade,
        className: work.className,
        category: work.category,
        description: work.description,
        coverImage: work.coverImage,
        coverSource: work.coverSource,
        hasHtml: !!work.htmlFile,
        status: work.status,
      },
    });
  } catch (error) {
    console.error('[camp/works/edit GET] error:', error);
    return NextResponse.json(
      { success: false, error: '获取作品失败' },
      { status: 500 },
    );
  }
};

// PATCH /api/camp/works/edit/:token —— 学生二次修改（multipart，可带文本字段 + coverFile + htmlFile）
export const PATCH = async (
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

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { success: false, error: '请求格式错误' },
        { status: 400 },
      );
    }

    const get = (k: string) => {
      const v = formData.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };

    const title = safeStr(get('title'), 120);
    const description = safeStr(get('description'), 2000);
    const className = safeStr(get('className'), 40);
    const categoryRaw = safeStr(get('category'), 20);
    const ALLOWED_CAT = ['作品', '项目', '代码', '其他'];
    const category = ALLOWED_CAT.includes(categoryRaw) ? categoryRaw : (work.category || '作品');
    const GRADE_OPTIONS = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '不便透露'];
    const gradeRaw = safeStr(get('grade'), 20);
    const grade = GRADE_OPTIONS.includes(gradeRaw) ? gradeRaw : (work.grade || '不便透露');

    if (!title) {
      return NextResponse.json(
        { success: false, error: '请填写作品标题' },
        { status: 400 },
      );
    }

    const data: Record<string, any> = {
      title,
      description: description || null,
      className: className || null,
      category,
      grade,
      updatedAt: new Date().toISOString(),
    };

    // 封面文件上传
    const coverFile = formData.get('coverFile');
    if (coverFile && typeof coverFile !== 'string') {
      const file = coverFile as File;
      const name = file.name || '';
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_COVER_EXT.includes(ext)) {
        return NextResponse.json(
          { success: false, error: '封面只支持 png / jpg / webp / gif 格式' },
          { status: 400 },
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: '封面图片不能超过 5MB' },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const filename = `${work.id}.${ext}`;
      writeFileSync(coverFilePath(filename), buf);
      data.coverImage = `/api/camp/covers/${filename}`;
      data.coverSource = 'upload';
    }

    // HTML 文件重传
    const htmlFile = formData.get('htmlFile');
    if (htmlFile && typeof htmlFile !== 'string') {
      const file = htmlFile as File;
      const name = file.name || '';
      const ext = (name.split('.').pop() || '').toLowerCase();
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
      data.htmlFile = saveHtmlFile(work.id, buf);
    }

    // 已通过审核的作品被学生再次修改后，回退到 pending 待老师复审
    if (work.status === 'approved') {
      data.status = 'pending';
    }

    await db.campWork.update({ where: { id: work.id }, data });

    const updated = await db.campWork.findUnique({ where: { id: work.id } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[camp/works/edit PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: `保存失败：${error?.message || '未知错误'}` },
      { status: 500 },
    );
  }
};
