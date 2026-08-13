'use client';

import { useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import type { PaperTrendItem } from '@/lib/types/paper-trend';

const CATEGORY_LABEL: Record<'choice' | 'read' | 'perfect', string> = {
  choice: '单项选择题',
  read: '阅读程序题',
  perfect: '完善程序题',
};

// "N 天前" 风格的中文相对时间。Intl.RelativeTimeFormat 输出的
// "1周前" 排版不友好（缺空格），自己格式化。
function relativeTimeZh(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '刚刚';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} 周前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 个月前`;
  return `${Math.floor(day / 365)} 年前`;
}

export function PaperReportModal({
  open,
  onClose,
  paper,
}: {
  open: boolean;
  onClose: () => void;
  paper: PaperTrendItem | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // ESC 关闭 + 打开时聚焦关闭按钮
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !paper) return null;

  const pct =
    paper.total.max > 0
      ? Math.round((paper.total.earned / paper.total.max) * 100)
      : 0;

  const handleRetry = () => {
    // 清除 QuizView 用来 rehydrate finalized 结果的 localStorage key
    localStorage.removeItem(`paperFinal:${paper.classroomId}`);
    window.location.href = `/classroom/${paper.classroomId}`;
  };

  const handleViewDetails = () => {
    window.location.href = `/classroom/${paper.classroomId}?scene=1`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paper-report-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <h2
            id="paper-report-title"
            className="text-base font-semibold text-slate-800 pr-4"
          >
            {paper.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 -m-1"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 text-center">
          <div className="text-5xl font-bold text-indigo-600 leading-none">
            {paper.total.earned}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            / {paper.total.max} 分
          </div>
          <div className="text-2xl font-semibold text-slate-700 mt-1">
            {pct}%
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {paper.sceneCount} 节 · {relativeTimeZh(paper.submittedAt)}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {(['choice', 'read', 'perfect'] as const).map((cat) => {
            const v = paper[cat];
            const ratio = v.max > 0 ? v.earned / v.max : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {v.earned} / {v.max}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新答题
          </button>
          <button
            type="button"
            onClick={handleViewDetails}
            className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 rounded-lg px-3 py-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
}
