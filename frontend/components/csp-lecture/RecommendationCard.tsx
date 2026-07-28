'use client';

/**
 * RecommendationCard — AI 推荐结果卡
 *
 * Shows the placement result: level badge, AI reason, and a clickable
 * list of recommended classroom links. Reached from the
 * "查看推荐" button on PlacementBanner.
 */

import { AnimatePresence, motion } from 'motion/react';
import { X, BookOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
};
const LEVEL_COLOR: Record<string, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-blue-500',
  advanced: 'bg-violet-500',
};

export type PlacementResult = {
  level: 'beginner' | 'intermediate' | 'advanced';
  // 旧字段：只有 id。保留它是为了让"老数据里只有 id 没有 title"的情况
  // 还能渲染（UI 退化成展示 id 字符串）。新数据优先看 recommendedClassrooms。
  recommendedIds?: string[];
  // 新字段：id + title，UI 优先用它来展示"实际课件名称"。
  recommendedClassrooms?: { id: string; title: string }[];
  aiReason: string;
  aiStatus?: 'ok' | 'fallback' | 'pending';
};

export function RecommendationCard({
  placement,
  onClose,
}: {
  placement: PlacementResult;
  onClose: () => void;
}) {
  const fallbackReason = '根据基础画像，暂未生成定制推荐。';
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <h2 className="text-lg font-bold text-slate-900">
              📊 你的 CSP 初赛等级
            </h2>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 flex-1">
            <div className="text-center mb-5">
              <div
                className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${LEVEL_COLOR[placement.level]} text-white text-2xl font-black shadow-lg`}
              >
                {LEVEL_LABEL[placement.level]}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-3 mb-5 text-sm text-slate-700 leading-relaxed flex gap-2">
              <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
              <span>{placement.aiReason || fallbackReason}</span>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              📚 为你推荐
            </h3>
            <div className="space-y-2">
              {(() => {
                // 优先用 recommendedClassrooms（新数据，含 title），
                // 退回 recommendedIds（旧数据，title 退化为 id）。
                const list =
                  placement.recommendedClassrooms && placement.recommendedClassrooms.length > 0
                    ? placement.recommendedClassrooms.map((c) => ({ id: c.id, title: c.title }))
                    : (placement.recommendedIds ?? []).map((id) => ({ id, title: id }));
                if (list.length === 0) {
                  return <div className="text-sm text-slate-500">暂无推荐课件。</div>;
                }
                return list.map(({ id, title }) => (
                  <Link
                    key={id}
                    href={`/classroom/${id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition px-4 py-3"
                  >
                    <BookOpen className="w-5 h-5 text-violet-500 shrink-0" />
                    <span className="text-sm text-slate-800 font-medium break-all flex-1">
                      {title}
                    </span>
                    <span className="text-violet-600 text-sm shrink-0">开始 →</span>
                  </Link>
                ));
              })()}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
            >
              关闭
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
