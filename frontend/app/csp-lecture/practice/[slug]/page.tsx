// Server-rendered page that displays one GESP / 课程 练习卷 markdown
// file from /public/csp-lecture/practice/. Slug matches the filename
// without extension (e.g. "gesp6-林展骥+林珅熠").
//
// **Publicly accessible** — no auth gate, so 学员 / 家长通过
// 直接分享链接就能打开练习卷, 题目里的所有洛谷题号都是
// clickable 直链, 点击直达题目页。

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { ChevronLeft, FileText, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRACTICE_DIR = path.join(process.cwd(), 'public', 'csp-lecture', 'practice');

// Whitelist slugs are derived from filesystem instead of a hardcoded
// list. Reading the actual directory on each request avoids:
//   1. 添加新练习卷时不需要同步修改白名单;
//   2. URL 编码后 slug 的 Unicode 标准化差异问题。
async function listAllowedSlugs(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(PRACTICE_DIR);
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
 * Minimal markdown → block list. 与 training/[slug] / exams/[slug]
 * 保持一致, 三个专题视觉统一。
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
 * Inline formatter: **bold**, *italic*, `inline code`,
 * [text](url) and bare autolinks. Order matters — we escape
 * HTML first so user content can't inject markup.
 *
 * 链接特殊处理: 任何 `luogu.com.cn/problem/...` 形式的链接
 * 在新窗口打开, 并加 `target="_blank" rel="noopener noreferrer"`,
 * 方便学员"看完题面 → 切回练习卷" 不用手动回退。
 */
function renderInline(input: string): string {
  let s = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // 绝对 URL — 全部新窗口打开, 配合练习卷"点击直达"诉求
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text, url) => {
      const isLuogu = /luogu\.com\.cn/.test(url);
      const icon = isLuogu
        ? ` <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-left:2px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
        : '';
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="practice-link${isLuogu ? ' practice-link-luogu' : ''}">${text}${icon}</a>`;
    },
  );

  s = s.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_m, lead, url) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer" class="practice-link">${url}</a>`,
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

export default async function PracticePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  // Decode percent-encoded unicode so the lookup matches the
  // disk filename. Next.js does not automatically decode
  // `params.slug` for us.
  //
  // **Path-segment decoding**: `decodeURIComponent` 把 `+` 当成空格
  // 解码, 但 `+` 在 URL path 段里就是字面加号, 不能误伤.
  // 先把字面 `+` 替换为 `%2B`, 再走 decodeURIComponent,
  // 避免「gesp6-林展骥+林珅熠」被错误解码成「gesp6-林展骥 林珅熠」.
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug.replace(/\+/g, '%2B'));
  } catch {
    slug = rawSlug;
  }
  if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    notFound();
  }

  const allowed = await listAllowedSlugs();
  if (!allowed.has(slug)) {
    notFound();
  }

  const filePath = path.join(PRACTICE_DIR, `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  raw = raw.replace(/^\ufeff/, '');

  const blocks = parseMarkdown(raw);
  const html = renderBlocks(blocks);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-rose-50/30">
      {/* noindex: 练习卷含真实学员姓名, 不应被搜索引擎收录 */}
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
          练习卷（点击题目直达洛谷）
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
        .prose-content h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 1.5em 0 0.75em; padding-bottom: 0.4em; border-bottom: 2px solid #f59e0b; }
        .prose-content h2 { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 1.5em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid #fde68a; }
        .prose-content h3 { font-size: 1.2rem; font-weight: 700; color: #334155; margin: 1.25em 0 0.5em; }
        .prose-content h4 { font-size: 1.05rem; font-weight: 600; color: #475569; margin: 1em 0 0.4em; }
        .prose-content p  { margin: 0.6em 0; }
        .prose-content ul, .prose-content ol { margin: 0.6em 0; padding-left: 1.6em; }
        .prose-content li { margin: 0.25em 0; }
        .prose-content blockquote { margin: 1em 0; padding: 0.6em 1em; background: #fffbeb; border-left: 4px solid #f59e0b; color: #334155; border-radius: 0 0.5rem 0.5rem 0; }
        .prose-content code { background: #f1f5f9; color: #be185d; padding: 0.1em 0.35em; border-radius: 0.25rem; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace; }
        .prose-content pre { margin: 1em 0; padding: 1em 1.2em; background: #0f172a; color: #e2e8f0; border-radius: 0.6rem; overflow-x: auto; font-size: 0.85em; line-height: 1.55; }
        .prose-content pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
        .prose-content table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.92em; }
        .prose-content thead { background: #fffbeb; }
        .prose-content th, .prose-content td { border: 1px solid #e2e8f0; padding: 0.5em 0.8em; text-align: left; }
        .prose-content th { font-weight: 600; color: #334155; }
        .prose-content a { color: #2563eb; text-decoration: none; }
        .prose-content a.practice-link-luogu { color: #d97706; font-weight: 600; border-bottom: 1.5px solid #fbbf24; padding-bottom: 1px; transition: all 0.15s; }
        .prose-content a.practice-link-luogu:hover { color: #b45309; border-bottom-color: #d97706; background: #fef3c7; border-radius: 2px; padding: 0 4px; margin: 0 -4px; }
        .prose-content a.practice-link:hover { color: #1d4ed8; text-decoration: underline; }
        .prose-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
        .prose-content strong { color: #0f172a; font-weight: 700; }
      `}</style>
    </main>
  );
}
