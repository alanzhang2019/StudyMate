'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ListChecks, MousePointerClick, Folder } from 'lucide-react';
import type { SceneType } from '@/lib/types/stage';
import { PaperReportRow } from './PaperReportRow';
import { PaperReportModal } from '@/components/csp-lecture/paper-report-modal';
import type { PaperTrendItem } from '@/lib/types/paper-trend';

type Chapter = {
  id: string;
  order: number;
  title: string;
  type: SceneType;
};

const TYPE_META: Record<SceneType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  slide: { label: '讲解', Icon: FileText },
  quiz: { label: '测验', Icon: ListChecks },
  interactive: { label: '互动', Icon: MousePointerClick },
  pbl: { label: '项目', Icon: Folder },
};

// module-level cache for paper-trend (5min TTL).
// 24 张真题卡都可能展开，缓存避免 24 次重复 fetch。
type PaperTrendCache = { ts: number; data: PaperTrendItem[] };
let _paperTrendCache: PaperTrendCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadPaperTrend(): Promise<PaperTrendItem[] | null> {
  const now = Date.now();
  if (_paperTrendCache && now - _paperTrendCache.ts < CACHE_TTL_MS) {
    return _paperTrendCache.data;
  }
  try {
    const res = await fetch('/api/csp-quiz/paper-trend');
    if (!res.ok) return null;
    const json = await res.json();
    const papers: PaperTrendItem[] = Array.isArray(json?.papers)
      ? json.papers
      : [];
    _paperTrendCache = { ts: now, data: papers };
    return papers;
  } catch {
    return null;
  }
}

/**
 * Collapsible chapter list inside a single lecture card on the
 * public /csp-lecture page. Each row deep-links into the player at
 * the corresponding scene via `?scene=<order>` (the player honours
 * that URL parameter on mount).
 *
 * Kept as a client component (only the toggle needs JS) so the
 * rest of the page can stay RSC and stream from the filesystem.
 */
export function ExpandChapterList({
  lectureId,
  chapters,
  isPaper,
}: {
  lectureId: string;
  chapters: Chapter[];
  isPaper?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [paperList, setPaperList] = useState<PaperTrendItem[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 真题卡片：展开时拉 paper-trend（命中模块缓存，1 次/5min）
  useEffect(() => {
    if (!open || !isPaper) return;
    let cancelled = false;
    loadPaperTrend().then((data) => {
      if (!cancelled) setPaperList(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, isPaper]);

  const myPaper = paperList?.find((p) => p.classroomId === lectureId) ?? null;

  if (chapters.length === 0) {
    return (
      <a
        href={`/classroom/${lectureId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        暂无可用章节，点击打开课件 →
      </a>
    );
  }

  return (
    <div>
      {/*
       * Persistent "从头开始学习" CTA — sits OUTSIDE the
       * collapsible chapter list so students can launch the
       * classroom in one click without first expanding the
       * chapter tree. The button is the primary affordance for
       * a new student; the chapter list is for re-entry into
       * a specific scene.
       */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <a
          href={`/classroom/${lectureId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold
                     text-white bg-gradient-to-r from-indigo-500 to-blue-500
                     hover:from-indigo-600 hover:to-blue-600
                     rounded-lg px-3 py-1.5 shadow-sm hover:shadow
                     transition"
        >
          从头开始学习 →
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600
                     hover:text-blue-600
                     focus:outline-none focus-visible:ring-2
                     focus-visible:ring-blue-400 rounded
                     px-1 -mx-1 py-0.5"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium">
            {open ? '收起章节' : `查看章节 (${chapters.length})`}
          </span>
        </button>
      </div>

      {open && (
        <ol className="mt-3 space-y-1.5 border-l-2 border-indigo-100 pl-3">
          {isPaper && paperList !== null && (
            <li key="__paper_report__">
              <PaperReportRow
                classroomId={lectureId}
                paper={myPaper}
                onOpenModal={() => setModalOpen(true)}
              />
            </li>
          )}
          {chapters.map((c) => {
            const meta = TYPE_META[c.type] ?? TYPE_META.slide;
            const Icon = meta.Icon;
            return (
              <li key={c.id}>
                <a
                  href={`/classroom/${lectureId}?scene=${c.order}`}
                  className="group flex items-start gap-2.5 rounded-md px-2 py-1.5
                             hover:bg-indigo-50/70 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span
                    className="shrink-0 mt-0.5 inline-flex items-center justify-center
                               w-6 h-6 rounded-full bg-slate-100 text-slate-500
                               text-[10px] font-semibold tabular-nums
                               group-hover:bg-indigo-200 group-hover:text-indigo-700"
                    aria-label={`第 ${c.order} 节`}
                  >
                    {c.order}
                  </span>
                  <Icon
                    className="shrink-0 mt-1 w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600"
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 group-hover:text-indigo-700 line-clamp-1">
                      {c.title}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-indigo-500">
                      {meta.label}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      {isPaper && (
        <PaperReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          paper={myPaper}
        />
      )}
    </div>
  );
}
