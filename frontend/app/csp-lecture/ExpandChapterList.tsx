'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ListChecks, MousePointerClick, Folder } from 'lucide-react';
import type { SceneType } from '@/lib/types/stage';

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
}: {
  lectureId: string;
  chapters: Chapter[];
}) {
  const [open, setOpen] = useState(false);

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
    </div>
  );
}
