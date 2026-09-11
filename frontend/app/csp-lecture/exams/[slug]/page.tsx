// Server-rendered page that displays a CSP mock exam markdown file
// from /public/csp-lecture/exams/. Slug matches the filename
// without extension (e.g. "模拟赛A-2026-10-04").
//
// Why a separate page rather than linking to the .md directly:
// 1. Browsers don't render markdown — they'd show raw text.
// 2. The aijiangti.cn CSP-lecture audience expects a consistent
//    "course" feel; a dedicated page keeps the nav, theming and
//    back-link intact.
// 3. We control the rendering: headers, code blocks, tables all
//    look like the rest of the site (matching the .prose styles
//    used elsewhere in the app).
//
// The renderer is intentionally minimal (no external dependency):
// it only handles the constructs that appear in our exam decks
// (H1..H4, fenced code, tables, bullet/ordered lists, blockquotes,
// bold, italic, inline code, autolinks). The exam markdowns are
// authored by us so the surface area stays bounded.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { ChevronLeft, FileText } from 'lucide-react';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EXAMS_DIR = path.join(process.cwd(), 'public', 'csp-lecture', 'exams');

// Whitelist slugs are now derived from filesystem instead of a
// hardcoded list. Reasoning: the previous hardcoded set meant
// every new exam required editing this file in two places
// (here + the MOCK_EXAMS array on the listing page), and the
// Unicode round-trip through the URL decoder could occasionally
// leave a slug in a different normalization form than what
// `ALLOWED_SLUGS.has()` checked against. Reading the actual
// directory on each request avoids both problems.
async function listAllowedSlugs(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(EXAMS_DIR);
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
 * {@link renderInline}.
 */
function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block: ```lang ... ```
    const fence = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push({ kind: 'code', lang, text: buf.join('\n') });
      continue;
    }

    // Heading: # .. ####
    const h = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length as 1 | 2 | 3 | 4, text: h[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line) || /^_{3,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Table: header row of `| ... |`, separator of `| --- | ... |`
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    // Blockquote: lines starting with "> "
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }

    // Unordered list: lines starting with "- " or "* "
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // Ordered list: lines starting with "1. " (any digit + ".")
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph: collect consecutive non-empty, non-special lines.
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
  // Strip leading/trailing pipe then split.
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
  // 1. Escape HTML.
  let s = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Inline code (must come before bold/italic so `**foo**`
  //    inside code stays literal).
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // 3. Links: [text](url). Only allow http(s) schemes.
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );

  // 4. Autolink bare URLs.
  s = s.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_m, lead, url) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  // 5. Bold then italic. We do bold first because the
  //    `**` delimiter is a strict superset of `*`.
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  // 6. Newlines → <br> (rarely needed but harmless).
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
          // Escape HTML in code so embedded `<` stays literal.
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

export default async function ExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Defence against path traversal: slug must be a non-empty
  // string without separators or `..` components. We do the
  // file existence check below to confirm the exam actually
  // exists on disk.
  if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    notFound();
  }

  // Same auth gate as /csp-lecture — the parent page requires
  // a signed-in user, so any deep link here must be too.
  const session = await auth();
  if (!session?.user) {
    redirect(`/auth/login?redirect=/csp-lecture/exams/${encodeURIComponent(slug)}&as=student`);
  }

  const filePath = path.join(EXAMS_DIR, `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  // Strip BOM if PowerShell produced one.
  raw = raw.replace(/^\ufeff/, '');

  const blocks = parseMarkdown(raw);
  const html = renderBlocks(blocks);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="max-w-4xl mx-auto flex items-center justify-between px-6 py-5">
        <Link
          href="/csp-lecture"
          className="inline-flex items-center gap-1.5 text-sm font-semibold
                     text-slate-700 hover:text-slate-900
                     bg-white/70 hover:bg-white
                     border border-slate-200 rounded-lg px-3 py-1.5
                     transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          返回 CSP 初赛通关宝典
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          模拟赛原题卷
        </span>
      </nav>

      <article className="max-w-4xl mx-auto px-6 pb-16">
        <div
          className="rounded-2xl border border-slate-200/60 bg-white/85 backdrop-blur
                     shadow-sm p-6 sm:p-10
                     prose-content"
          // The HTML comes from our own parser, not user-supplied
          // markdown, so dangerouslySetInnerHTML is safe here.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      {/* Scoped styles. The `.prose-content` class is referenced
          in the article above; rules below tune the rendered
          markdown to match the site's visual language. */}
      <style>{`
        .prose-content { color: #1f2937; line-height: 1.75; font-size: 15px; }
        .prose-content h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 1.5em 0 0.75em; padding-bottom: 0.4em; border-bottom: 2px solid #e2e8f0; }
        .prose-content h2 { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 1.5em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid #e2e8f0; }
        .prose-content h3 { font-size: 1.2rem; font-weight: 700; color: #334155; margin: 1.25em 0 0.5em; }
        .prose-content h4 { font-size: 1.05rem; font-weight: 600; color: #475569; margin: 1em 0 0.4em; }
        .prose-content p  { margin: 0.6em 0; }
        .prose-content ul, .prose-content ol { margin: 0.6em 0; padding-left: 1.6em; }
        .prose-content li { margin: 0.25em 0; }
        .prose-content blockquote { margin: 1em 0; padding: 0.6em 1em; background: #f1f5f9; border-left: 4px solid #6366f1; color: #334155; border-radius: 0 0.5rem 0.5rem 0; }
        .prose-content code { background: #f1f5f9; color: #be185d; padding: 0.1em 0.35em; border-radius: 0.25rem; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace; }
        .prose-content pre { margin: 1em 0; padding: 1em 1.2em; background: #0f172a; color: #e2e8f0; border-radius: 0.6rem; overflow-x: auto; font-size: 0.85em; line-height: 1.55; }
        .prose-content pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
        .prose-content table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.92em; }
        .prose-content thead { background: #f8fafc; }
        .prose-content th, .prose-content td { border: 1px solid #e2e8f0; padding: 0.5em 0.8em; text-align: left; }
        .prose-content th { font-weight: 600; color: #334155; }
        .prose-content a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
        .prose-content a:hover { color: #4338ca; }
        .prose-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
        .prose-content strong { color: #0f172a; font-weight: 700; }
      `}</style>
    </main>
  );
}
