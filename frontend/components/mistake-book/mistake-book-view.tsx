'use client';

// /components/mistake-book/mistake-book-view
//
// 错题本的可视化组件，把 loadCspMistakeBook 返回的 groups 渲染
// 成"按课件分组的可折叠卡片列表"。是 server component
// /student/csp-mistakes 的纯展示 + 交互子组件。
//
// 交互：
//  - 每张课件卡片可单独展开/折叠（用本地 state）
//  - 顶部"全部展开 / 全部折叠"按钮快捷操作
//  - 每道错题下方有"去课件复习"按钮，跳到该 scene 重新作答

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, BookOpen, XCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateBeijing } from '@/lib/utils/date';
import type { MistakeGroup, MistakeRecord } from '@/lib/server/csp-mistake-book';

function isAnswerEqual(
  user: string | string[],
  correct: string | string[],
): boolean {
  const norm = (x: string | string[]): string[] =>
    Array.isArray(x) ? [...x].sort() : [x];
  const a = norm(user);
  const b = norm(correct);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function joinAnswer(v: string | string[] | undefined): string {
  if (v === undefined) return '—';
  if (Array.isArray(v)) return v.join(', ');
  return v;
}

export function MistakeBookView({ groups }: { groups: MistakeGroup[] }) {
  // 记录每个课件的展开/折叠状态。默认全部展开（学生上来就
  // 应该能看到所有错题）。key 用 classroomId 而不是数组 index，
  // 避免下次分组顺序变化时状态串台。
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of groups) init[g.classroomId] = true;
    return init;
  });

  const allExpanded = useMemo(
    () => groups.every((g) => expanded[g.classroomId] !== false),
    [expanded, groups],
  );

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.classroomId] = !allExpanded;
    setExpanded(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          按 <span className="font-semibold text-slate-800">课件</span> 分类，共 {groups.length} 本
        </div>
        <Button size="sm" variant="ghost" onClick={toggleAll}>
          {allExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" /> 全部折叠
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" /> 全部展开
            </>
          )}
        </Button>
      </div>

      {groups.map((g) => {
        const isOpen = expanded[g.classroomId] !== false;
        return (
          <Card
            key={g.classroomId}
            className="bg-white/85 backdrop-blur border-slate-200/60 shadow-sm"
          >
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => toggle(g.classroomId)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left
                           hover:bg-slate-50/60 transition-colors
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                aria-expanded={isOpen}
                aria-controls={`mistake-group-${g.classroomId}`}
              >
                <div
                  className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600
                             flex items-center justify-center text-white"
                >
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {g.classroomTitle}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50
                                 text-rose-700 border border-rose-200 px-2 py-0.5
                                 font-semibold"
                    >
                      <XCircle className="w-3 h-3" aria-hidden="true" />
                      {g.mistakeCount} 道错题
                    </span>
                    <span>·</span>
                    <span>最近答错 {formatDateBeijing(g.lastMistakeAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-slate-400">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div
                  id={`mistake-group-${g.classroomId}`}
                  className="border-t border-slate-200/80 divide-y divide-slate-100"
                >
                  {g.mistakes.map((m) => (
                    <MistakeItem
                      key={`${m.sceneId}::${m.questionId}`}
                      record={m}
                      classroomId={g.classroomId}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MistakeItem({
  record,
  classroomId,
}: {
  record: MistakeRecord;
  classroomId: string;
}) {
  const correctMatched = isAnswerEqual(record.userAnswer, record.correctAnswer);
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase
                     tracking-wider text-rose-700 bg-rose-50 border border-rose-200
                     rounded px-1.5 py-0.5"
        >
          <XCircle className="w-3 h-3" aria-hidden="true" />
          错题
        </span>
        <span className="text-[11px] text-slate-500">
          {record.sceneTitle}
        </span>
        <span className="text-[11px] text-slate-400 ml-auto">
          {formatDateBeijing(record.at)}
          {record.mistakeCount > 1 && (
            <span className="ml-2 text-rose-600 font-semibold">
              · 答错 {record.mistakeCount} 次
            </span>
          )}
        </span>
      </div>

      <div className="text-sm text-slate-800 leading-relaxed mb-3 whitespace-pre-wrap">
        {record.questionText}
      </div>

      {/* Options */}
      {record.options.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {record.options.map((opt) => {
            const isCorrect = isAnswerEqual([opt.value], record.correctAnswer);
            const isPicked = isAnswerEqual([opt.value], record.userAnswer);
            const tone = isCorrect
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : isPicked
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-slate-200 bg-white text-slate-700';
            return (
              <li
                key={opt.value}
                className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-1.5 ${tone}`}
              >
                <span className="font-semibold shrink-0 w-6">{opt.value}.</span>
                <span className="flex-1">{opt.label}</span>
                {isCorrect && (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    aria-label="正确答案"
                  />
                )}
                {isPicked && !isCorrect && (
                  <XCircle
                    className="w-4 h-4 text-rose-600 shrink-0"
                    aria-label="你的答案"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Answer summary (multi-select or fallback) */}
      {record.options.length === 0 ||
      !Array.isArray(record.correctAnswer) ||
      (Array.isArray(record.correctAnswer) && record.correctAnswer.length > 1) ||
      correctMatched === false ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
              你的答案
            </div>
            <div className="mt-0.5 text-rose-800 font-mono break-words">
              {joinAnswer(record.userAnswer)}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              正确答案
            </div>
            <div className="mt-0.5 text-emerald-800 font-mono break-words">
              {joinAnswer(record.correctAnswer)}
            </div>
          </div>
        </div>
      ) : null}

      {record.analysis && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            解析
          </div>
          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {record.analysis}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <Link
          href={`/classroom/${classroomId}?scene=${encodeURIComponent(record.sceneId)}&resume=1`}
          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          去课件复习这道题
        </Link>
        <span className="text-slate-300">·</span>
        <span className="text-slate-400">{record.points} 分</span>
      </div>
    </div>
  );
}
