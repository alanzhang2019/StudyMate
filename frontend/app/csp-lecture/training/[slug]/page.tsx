// Server-rendered page that displays one training plan markdown
// file from /public/csp-lecture/training/. Slug matches the
// filename without extension (e.g. "赵永浩", "题库").
//
// **Publicly accessible** — no auth gate, so 学员 / 家长通过
// 直接分享链接就能打开每个学员的训练计划。
//
// 与 exams/[slug] 的渲染逻辑基本一致; 区别在于训练计划
// 文档里使用了相对路径链接 (例如 `./_shared/题库.md`),
// inline 渲染时识别出这种相对引用, 拼成
// `/csp-lecture/training/<slug>` 同目录 URL, 而不是用
// markdown 默认的"按字符串保留"行为 (那样浏览器打开会
// 直接 404)。

import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { ChevronLeft, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRAINING_DIR = path.join(process.cwd(), 'public', 'csp-lecture', 'training');

// **Slug aliases**: 老链接里的中文连接符从 '+' 改成了 '-',
// 早期还用过 '、' (U+3001). 任何已分享出去的旧链接
// (家长群、Notion、微信收藏) 在新容器里都直接 301 到新 slug,
// 避免点击 → 404 的尴尬。
//
// 格式: 'old-slug' → 'new-slug'. 旧 → 新 只能 1 跳,
// 别在这里写循环 (e.g. A→B, B→A) 否则会无限重定向。
const SLUG_ALIASES: Record<string, string> = {
  '2026-09-12加课-GESP6林展骥+林珅熠': '2026-09-12加课-GESP6林展骥-林珅熠',
  '2026-09-12加课-GESP6林展骥、林珅熠': '2026-09-12加课-GESP6林展骥-林珅熠',
};

// Whitelist slugs are derived from filesystem instead of a
// hardcoded list. Reading the actual directory on each request
// avoids two failure modes:
//   1. 添加新学员训练计划时不需要同步修改这里的白名单;
//   2. URL 编码后 slug 的 Unicode 标准化差异不会再让白名单
//      `has()` 检查结果与磁盘文件名不一致。
async function listAllowedSlugs(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(TRAINING_DIR);
    return new Set(
      entries
        .filter((n) => n.endsWith('.md'))
        .map((n) => n.slice(0, -'.md'.length)),
    );
  } catch {
    return new Set();
  }
}

type Block =
  | { kind: 'h'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

/**
 * Minimal markdown → block list. Block-level first; inline
 * formatting (bold, code, links) is applied at render time via
 * {@link renderInline}. 与 exams/[slug] 的解析器保持一致, 这样
 * 两个专题 (真题 / 训练计划) 在视觉上完全统一。
 */
function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: 'code', lang, text: buf.join('\n') });
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length as 1 | 2 | 3 | 4, text: h[2] });
      i++;
      continue;
    }

    if (/^-{3,}\s*$/.test(line) || /^_{3,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', text: buf.join('\n') });
  }
  return blocks;
}

function isBlockStart(line: string): boolean {
  if (/^#{1,4}\s+/.test(line)) return true;
  if (/^```/.test(line)) return true;
  if (/^[-*]\s+/.test(line)) return true;
  if (/^\d+\.\s+/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^\s*\|.*\|\s*$/.test(line)) return true;
  if (/^-{3,}\s*$/.test(line)) return true;
  return false;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Inline formatter: handles **bold**, *italic*, `inline code`,
 * [text](url) and bare autolinks. Order matters — we escape
 * HTML first so user content can't inject markup.
 */
function renderInline(input: string): string {
  let s = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );

  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text, url) => {
      // 已经是绝对 URL (e.g. https://...) 的, 跳过 — 上面那条
      // 正则已处理. 这里处理相对路径 (例如 ./题库.md,
      // _shared/日历.md) 和裸锚点 (#W0).
      if (/^(https?:)?\/\//i.test(url) || url.startsWith('#')) return `[${text}](${url})`;
      // 去掉 .md 后缀 (浏览器里没必要强制下载); 保留 .md#anchor
      // 这种带锚点的情况, 锚点 # 部分要留下来。
      const cleaned = url.replace(/\.md(?=#|$)/i, '');
      // 训练计划文档约定把共享资源 (题库 / 日历) 放在
      // `_shared/` 子目录下, 但实际部署时为了 URL 美观 + 与
      // 个人学员计划保持平级, 把这两个文件放在了 training/ 根
      // 目录. 所以这里把 `_shared/` 前缀去掉, 让旧文档的相对
      // 引用仍然指向同目录的共享文件.
      const withoutShared = cleaned.replace(/(^|\/)\.?_shared\//, '$1');
      // 同目录引用, 拼成 /csp-lecture/training/<slug>
      return `<a href="/csp-lecture/training/${encodeURI(withoutShared.replace(/^\.\//, '').replace(/^\//, ''))}">${text}</a>`;
    },
  );

  s = s.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_m, lead, url) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  s = s.replace(/\n/g, '<br/>');
  return s;
}

function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'h': {
          const id = b.text
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
            .replace(/^-|-$/g, '');
          return `<h${b.level} id="${id}">${renderInline(b.text)}</h${b.level}>`;
        }
        case 'p':
          return `<p>${renderInline(b.text)}</p>`;
        case 'code': {
          const escaped = b.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return `<pre data-lang="${b.lang}"><code>${escaped}</code></pre>`;
        }
        case 'ul':
          return `<ul>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`;
        case 'table': {
          const head = `<thead><tr>${b.header.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
          const body = `<tbody>${b.rows
            .map(
              (r) =>
                `<tr>${r
                  .map((c) => `<td>${renderInline(c)}</td>`)
                  .join('')}</tr>`,
            )
            .join('')}</tbody>`;
          return `<table>${head}${body}</table>`;
        }
        case 'quote':
          return `<blockquote>${renderInline(b.text)}</blockquote>`;
        case 'hr':
          return `<hr/>`;
      }
    })
    .join('\n');
}

export default async function TrainingPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  // Decode percent-encoded unicode (e.g. `%E8%B5%B5%E6%B0%B8%E6%B5%A9`)
  // so the lookup matches the disk filename. Next.js does not
  // automatically decode `params.slug` for us.
  //
  // **Path-segment decoding**: `decodeURIComponent` 把 `+` 当成空格
  // 解码, 但 `+` 在 URL path 段里就是字面加号, 不能误伤.
  // 先把字面 `+` 替换为 `%2B`, 再走 decodeURIComponent,
  // 避免「2026-09-12加课-GESP6林展骥+林珅熠」被错误解码成
  // 「... 林珅熠」找不到对应文件。
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug.replace(/\+/g, '%2B'));
  } catch {
    slug = rawSlug;
  }
  if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    notFound();
  }

  // 老 slug → 新 slug 永久重定向. 必须在白名单检查之前做,
  // 否则 file lookup 会先 404. encodeURIComponent 让新 slug
  // 的中文字符重新走 URL 编码 (避免浏览器对已编码 URL
  // 再次嵌套编码).
  if (SLUG_ALIASES[slug] && SLUG_ALIASES[slug] !== slug) {
    permanentRedirect(`/csp-lecture/training/${encodeURIComponent(SLUG_ALIASES[slug])}`);
  }

  const allowed = await listAllowedSlugs();
  if (!allowed.has(slug)) {
    notFound();
  }

  const filePath = path.join(TRAINING_DIR, `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  raw = raw.replace(/^\ufeff/, '');

  const blocks = parseMarkdown(raw);
  const html = renderBlocks(blocks);

  // 顶部 nav 文案根据 slug 切换. 共享资源 (题库 / 日历) 顶部
  // 显示"共享资源", 个人训练计划显示"学员训练计划".
  const isShared = slug === '题库' || slug === '日历';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/40">
      {/* noindex: 训练计划含真实学员姓名, 不应被搜索引擎收录 */}
      <meta name="robots" content="noindex,nofollow" />

      <nav className="max-w-4xl mx-auto flex items-center justify-between px-6 py-5">
        <Link
          href="/csp-lecture/training"
          className="inline-flex items-center gap-1.5 text-sm font-semibold
                     text-slate-700 hover:text-slate-900
                     bg-white/70 hover:bg-white
                     border border-slate-200 rounded-lg px-3 py-1.5
                     transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          返回训练计划总览
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          {isShared ? '共享资源' : '学员训练计划'}
        </span>
      </nav>

      <article className="max-w-4xl mx-auto px-6 pb-16">
        <div
          className="rounded-2xl border border-slate-200/60 bg-white/85 backdrop-blur
                     shadow-sm p-6 sm:p-10
                     prose-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <style>{`
        .prose-content { color: #1f2937; line-height: 1.75; font-size: 15px; }
        .prose-content h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 1.5em 0 0.75em; padding-bottom: 0.4em; border-bottom: 2px solid #e2e8f0; }
        .prose-content h2 { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 1.5em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid #e2e8f0; }
        .prose-content h3 { font-size: 1.2rem; font-weight: 700; color: #334155; margin: 1.25em 0 0.5em; }
        .prose-content h4 { font-size: 1.05rem; font-weight: 600; color: #475569; margin: 1em 0 0.4em; }
        .prose-content p  { margin: 0.6em 0; }
        .prose-content ul, .prose-content ol { margin: 0.6em 0; padding-left: 1.6em; }
        .prose-content li { margin: 0.25em 0; }
        .prose-content blockquote { margin: 1em 0; padding: 0.6em 1em; background: #f1f5f9; border-left: 4px solid #10b981; color: #334155; border-radius: 0 0.5rem 0.5rem 0; }
        .prose-content code { background: #f1f5f9; color: #be185d; padding: 0.1em 0.35em; border-radius: 0.25rem; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace; }
        .prose-content pre { margin: 1em 0; padding: 1em 1.2em; background: #0f172a; color: #e2e8f0; border-radius: 0.6rem; overflow-x: auto; font-size: 0.85em; line-height: 1.55; }
        .prose-content pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
        .prose-content table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.92em; }
        .prose-content thead { background: #f8fafc; }
        .prose-content th, .prose-content td { border: 1px solid #e2e8f0; padding: 0.5em 0.8em; text-align: left; }
        .prose-content th { font-weight: 600; color: #334155; }
        .prose-content a { color: #059669; text-decoration: underline; text-underline-offset: 2px; }
        .prose-content a:hover { color: #047857; }
        .prose-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
        .prose-content strong { color: #0f172a; font-weight: 700; }
      `}</style>
    </main>
  );
}
