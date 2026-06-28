import Link from 'next/link';

import { Card } from '@/components/ui/card';
import type { DashboardMistake } from '@/lib/parent/dashboard';

interface Props {
  mistakes: DashboardMistake[];
}

const SUBJECT_COLOR: Record<string, string> = {
  数学: 'bg-blue-100 text-blue-700',
  语文: 'bg-rose-100 text-rose-700',
  英语: 'bg-violet-100 text-violet-700',
  物理: 'bg-amber-100 text-amber-700',
  化学: 'bg-emerald-100 text-emerald-700',
};

function subjectClass(subject: string | null): string {
  if (!subject) return 'bg-slate-100 text-slate-600';
  return SUBJECT_COLOR[subject] ?? 'bg-slate-100 text-slate-600';
}

export function MistakeList({ mistakes }: Props) {
  if (mistakes.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700">最近的错题</h3>
        <p className="mt-3 text-sm text-slate-500">
          孩子还没有添加错题。让孩子去
          <Link
            href="/mistake-book"
            className="mx-1 text-blue-600 underline-offset-2 hover:underline"
          >
            「我的错题本」
          </Link>
          添加几道吧，AI 就能给出更准确的点评。
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-700">
        最近的错题 <span className="text-slate-400">（{mistakes.length}）</span>
      </h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {mistakes.map((m) => {
          const resolved = m.isResolved === 1;
          return (
            <li key={m.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${subjectClass(m.subject)}`}
                  >
                    {m.subject ?? '未分类'}
                  </span>
                  {m.grade && (
                    <span className="text-[10px] text-slate-400">
                      {m.grade}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    resolved
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {resolved ? '已掌握' : '未掌握'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-700 line-clamp-2">
                {m.problemText}
              </p>
              {(m.userAnswer || m.correctAnswer) && (
                <p className="mt-1 text-xs text-slate-400">
                  {m.userAnswer && (
                    <span>孩子的答案：{m.userAnswer}</span>
                  )}
                  {m.userAnswer && m.correctAnswer && <span>　·　</span>}
                  {m.correctAnswer && (
                    <span>正确答案：{m.correctAnswer}</span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
