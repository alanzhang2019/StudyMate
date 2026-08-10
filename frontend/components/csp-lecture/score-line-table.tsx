'use client';

// /components/csp-lecture/score-line-table.tsx
//
// 近 7 年广东晋级线 + 全国一/二/三等线的小型数据表。
//
// 用途：
//   - 让学生在打开 /csp-lecture 时 (还没做题) 就能看到历年晋级难度。
//   - 做 K线图的"地面真相"：K线图里画的 markLine 就是这张表里
//     的数字；学生若对某条线有疑问，可以在这里查到完整数据。
//   - 表格行高对比 3 个等级 (J / S / 全国总分 100) 的比例尺，
//     让学生感受到"广东晋级线通常比全国三等线高一截"。
//
// 设计要点：
//   - J / S 分两个 tab，方便对比；
//   - 行 = 年份 (升序) ；列 = 晋级 / 一等 / 二等 / 三等；
//   - 当前年 (本年度 = 2025) 的格子高亮"今年"，引导先做最新卷。
//
// 数据来自 /lib/csp-score-lines.ts 共享给 K线图。

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  SCORE_LINES,
  SCORE_LINE_META,
  AWARD_LABEL,
  classifyAward,
  type CspGroup,
  type ScoreLineKey,
} from '@/lib/csp-score-lines';

const GROUP_LABEL: Record<CspGroup, string> = {
  J: 'J 组（普及组）',
  S: 'S 组（提高组）',
};

const COLUMN_ORDER: ScoreLineKey[] = ['promotion', 'first', 'second', 'third'];

const COLUMN_LABEL: Record<ScoreLineKey, string> = {
  promotion: '广东晋级线',
  first: '全国一等',
  second: '全国二等',
  third: '全国三等',
};

const CURRENT_YEAR = 2025; // 数据截止年份（不再作为"今年"高亮，保留常量
                            // 避免误删后续可能用到的判断逻辑；用户已要求
                            // 删除"今年"徽标）。

export function ScoreLineTable({ className }: { className?: string }) {
  const [group, setGroup] = useState<CspGroup>('J');
  const rows = useMemo(
    () => SCORE_LINES.filter((s) => s.group === group).sort((a, b) => a.year - b.year),
    [group],
  );

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500
                       flex items-center justify-center text-white text-lg font-bold"
            aria-hidden="true"
          >
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 leading-snug">
              近 7 年广东晋级线 · 全国一/二/三等线
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              数据来源：CCF 公布 · 用于对照你在 K 线图上的得分，定位"距晋级还差多少分"
            </p>
          </div>
        </div>

        {/* J / S 切换 */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4" role="tablist">
          {(['J', 'S'] as CspGroup[]).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
              className={
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ' +
                (group === g
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700')
              }
            >
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-3">年份</th>
                {COLUMN_ORDER.map((k) => (
                  <th
                    key={k}
                    className="text-right text-xs font-semibold text-slate-500 py-2 px-2 whitespace-nowrap"
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                      style={{ background: SCORE_LINE_META[k].color }}
                      aria-hidden="true"
                    />
                    {COLUMN_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                return (
                  <tr
                    key={r.year}
                    className="border-t border-slate-100"
                  >
                    <td className="py-2 pr-3 tabular-nums">
                      <span className="text-slate-700 font-medium">
                        {r.year}
                      </span>
                    </td>
                    {COLUMN_ORDER.map((k) => (
                      <td
                        key={k}
                        className="py-2 px-2 text-right tabular-nums font-mono text-slate-700"
                      >
                        {r[k]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          说明：表中"广东晋级线"是 CCF 公布的当年广东省初赛通过线，
          对应"能不能去复赛"；三列"全国一/二/三等"是按全国考生总分
          排序划分的奖项分数线 (各省再按比例分配名额)。
          数据范围 2019–2025，2018 及之前年份暂未收录。
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * 把"分数 → 奖项"翻译成中文短句，可嵌入到 AI 报告或提示语。
 * 单独 export 出来方便在其他地方复用。
 */
export function describeAwardForScore(
  score: number,
  year: number,
  group: CspGroup,
): string {
  const band = classifyAward(score, year, group);
  if (band === 'unknown') return `${year} 年 ${group} 组无对照数据`;
  return AWARD_LABEL[band];
}
