import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { EXAM_PAPERS } from '../../../../lib/examPapers';

export const runtime = 'nodejs';
// 真题文件为静态资源，但走 Next 路由以便设置下载头与防目录遍历

const ROOT = path.join(process.cwd(), 'data', 'exam-papers');

const CT: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pdf: 'application/pdf',
};

// PDF 走 inline（浏览器可「新标签打开」直接预览），Word 只能下载。
const INLINE_EXT = new Set(['pdf']);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (!slug || slug.length < 2) {
    return new Response('Bad Request', { status: 400 });
  }
  const rel = slug.join('/');
  // 只允许 <subject>/<fileName>，文件名仅含安全字符，防目录遍历
  if (!/^[a-z]+(\/[A-Za-z0-9_-]+\.(docx|doc|pdf))?$/.test(rel)) {
    return new Response('Bad Request', { status: 400 });
  }
  const abs = path.join(ROOT, rel);
  const realRoot = fs.realpathSync(ROOT);
  if (!fs.existsSync(abs) || !fs.realpathSync(abs).startsWith(realRoot)) {
    return new Response('Not Found', { status: 404 });
  }
  const ext = path.extname(abs).slice(1).toLowerCase();
  const buf = fs.readFileSync(abs);

  // 下载文件名取中文标题，便于用户识别
  const paper = EXAM_PAPERS.find((p) => p.fileName === path.basename(abs));
  const name = (paper ? paper.title : path.basename(abs)) + '.' + ext;
  const disp = `${INLINE_EXT.has(ext) ? 'inline' : 'attachment'}; filename="${path.basename(abs)}"; filename*=UTF-8''${encodeURIComponent(name)}`;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': CT[ext] || 'application/octet-stream',
      'Content-Disposition': disp,
      'Content-Length': String(buf.length),
      // 回忆版可能被勘误重传，故 PDF 不设 immutable；Word 原卷为一次性归档，可长缓存。
      'Cache-Control': INLINE_EXT.has(ext)
        ? 'public, max-age=3600'
        : 'public, max-age=31536000, immutable',
    },
  });
}
