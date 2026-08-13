// frontend/app/csp-lecture/PaperReportRow.tsx
'use client';

import { BarChart3, Rocket } from 'lucide-react';
import type { PaperTrendItem } from '@/lib/types/paper-trend';

/**
 * 折叠面板内"上次成绩 / 开始挑战"特殊行。
 *
 *  - paper === null：未提交过任意小节 → 整行是个 <a>，跳课堂首页
 *  - paper !== null：已交卷 → 整行是 <button>，调 onOpenModal 弹 modal
 *
 * 视觉上与下方 <ol> 章节项齐平，但用 amber 渐变 + 4px 强调左边框
 * 突出"非普通章节"语义。
 */
export function PaperReportRow({
  classroomId,
  paper,
  onOpenModal,
}: {
  classroomId: string;
  paper: PaperTrendItem | null;
  onOpenModal: () => void;
}) {
  if (!paper) {
    return (
      <a
        href={`/classroom/${classroomId}`}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5
                   bg-gradient-to-r from-indigo-50 to-blue-50
                   border-l-4 border-indigo-400
                   hover:from-indigo-100 hover:to-blue-100
                   transition-colors"
      >
        <Rocket className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="text-sm font-medium text-indigo-700 flex-1">
          尚未挑战这套卷
        </span>
        <span className="text-xs font-semibold text-white bg-indigo-500 rounded px-2 py-0.5">
          开始挑战
        </span>
      </a>
    );
  }

  const pct =
    paper.total.max > 0
      ? Math.round((paper.total.earned / paper.total.max) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="w-full text-left flex items-center gap-2.5 rounded-md px-2 py-1.5
                 bg-gradient-to-r from-amber-50 to-yellow-50
                 border-l-4 border-amber-400
                 hover:from-amber-100 hover:to-yellow-100
                 transition-colors
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" />
      <span className="text-sm font-medium text-amber-800 flex-1">
        上次成绩：{paper.total.earned} / {paper.total.max}（{pct}%）
      </span>
      <span className="text-xs font-semibold text-amber-900 bg-amber-200 rounded px-2 py-0.5">
        查看详情
      </span>
    </button>
  );
}
