'use client';

// /components/csp-lecture/paper-score-trend.tsx
//
// 历年真题成绩趋势图。
//
// 数据来源：/api/csp-quiz/paper-trend (返回当前用户答过的所有
// 24 套历年真题 J/S 的总分)。图表分两张子图（J 组 / S 组）左右
// 并排，每张子图只画 1 条折线：
//   - 总分（深紫，加粗实线）
// 并叠加 1 条参考线：
//   - 广东晋级线（红色虚线，用所有年份的中位数作 yAxis）
//
// 简化原因 (commit on 2026-08-11)：用户反馈 K 线图只需要"总分
// 走势 + 晋级线"两个信息, 单项选择 / 阅读程序 / 完善程序 3 条分
// 类线 + 全国一二三等参考线让学生看不懂、抓不到重点, 反倒把真正
// 关心的"我离晋级还差几分"信号淹没。精简后图面清爽, 趋势一眼能
// 看出, 历年精确分项得分保留在 tooltip 弹层里, 想看能下钻。
//
// 使用 ECharts (SVG renderer) 渲染：
//   - 与 slide-renderer/ChartElement 同一套 import 方式
//     (echarts/core + LineChart + TooltipComponent +
//     LegendComponent + GridComponent + TitleComponent +
//     SVGRenderer)，保证 tree-shake 后 bundle 最小；
//   - SVGRenderer 输出的 SVG 节点走 Tailwind 控制样式 / 颜色
//     继承，避免 canvas 在高 DPI 屏上的锯齿问题。
//
// 三种渲染状态：
//   - loading: 居中 spinner + "加载中" 文案
//   - empty (0 papers): 友好提示 "还没有完成任何历年真题，去做
//     一套试试看"
//   - rendered: ECharts 实例
//
// 1 条折线 (总分) 为左 Y 轴 0-100 分；右 Y 轴不启用。Tooltip
// trigger: 'axis'，鼠标 hover 任何一年会同时显示总分走势 +
// 该年具体分项得分 + 该年广东晋级 / 全国一/二/三等线 (细节下钻)。
// 点击穿透到对应卷子的链接行为不在此实现, 避免图表成为跳转器
// 干扰阅读趋势 —— 学生要看具体某年分数直接下拉到下方 24 张卡片。

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  SVGRenderer,
]);

import {
  getScoreLine,
  SCORE_LINE_META,
  SCORE_LINE_KEYS,
  type CspGroup,
} from '@/lib/csp-score-lines';

type CategoryKey = 'choice' | 'read' | 'perfect';

type PaperTrendItem = {
  classroomId: string;
  title: string;
  year: number;
  group: 'J' | 'S';
  choice: { earned: number; max: number };
  read: { earned: number; max: number };
  perfect: { earned: number; max: number };
  total: { earned: number; max: number; score: number };
  submittedAt: string;
  sceneCount: number;
  mode: 'standard' | 'legacy';
};

type ApiResponse = {
  papers: PaperTrendItem[];
  labels: Record<CategoryKey, string>;
};

const TOTAL_COLOR = '#7c3aed'; // violet-600
const TOTAL_LINE_WIDTH = 3;

interface Props {
  /**
   * 可选：父级传入的额外 className（控制外边距、宽度等）。
   * 默认紧贴父容器宽度。
   */
  className?: string;
  /**
   * 可选：嵌入在学生中心 /student/home 时不需要 "加载更多" 类
   * 链接，传入 true 时隐藏 "查看历年真题" 跳转按钮。
   */
  hideFooterLink?: boolean;
}

export function PaperScoreTrendChart({ className, hideFooterLink }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/csp-quiz/paper-trend', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 按 group 切分成两张子图用的数据
  const { jPapers, sPapers } = useMemo(() => {
    const j: PaperTrendItem[] = [];
    const s: PaperTrendItem[] = [];
    for (const p of data?.papers ?? []) {
      if (p.group === 'J') j.push(p);
      else if (p.group === 'S') s.push(p);
    }
    return { jPapers: j, sPapers: s };
  }, [data]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载历年真题成绩趋势…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-10 text-center text-rose-600 text-sm">
          趋势图加载失败：{error}
        </CardContent>
      </Card>
    );
  }

  const totalAttempted = (data?.papers ?? []).length;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        {/* 标题 + 副标题（嵌入 /csp-lecture 时显示完整 hero；
            /student/home 嵌入时可被父容器覆盖） */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <LineChartIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 leading-snug">
              我的历年真题成绩趋势
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              共完成 {totalAttempted} 套真题 · 折线展示历年总分走势，
              红色虚线为该组历年广东晋级线 (取中位数) ·
              点击某一年可在 tooltip 看到分项得分与一/二/三等对照
            </p>
          </div>
        </div>

        {totalAttempted === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              还没有完成任何历年真题
            </p>
            <p className="text-xs text-slate-500 mt-1">
              去下方任意一套真题卷做一做，成绩会自动汇总到这里。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SubChart
              title="J 组（普及组）"
              papers={jPapers}
              group="J"
              labels={data?.labels ?? {
                choice: '单项选择题',
                read: '阅读程序题',
                perfect: '完善程序题',
              }}
            />
            <SubChart
              title="S 组（提高组）"
              papers={sPapers}
              group="S"
              labels={data?.labels ?? {
                choice: '单项选择题',
                read: '阅读程序题',
                perfect: '完善程序题',
              }}
            />
          </div>
        )}

        {!hideFooterLink && (
          <div className="mt-5 text-center">
            <Link
              href="/csp-lecture"
              className="text-xs font-semibold text-violet-700 hover:text-violet-900"
            >
              查看历年真题卷 →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubChart({
  title,
  papers,
  group,
  labels,
}: {
  title: string;
  papers: PaperTrendItem[];
  group: 'J' | 'S';
  labels: Record<CategoryKey, string>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current, null, { renderer: 'svg' });
    const ro = new ResizeObserver(() => inst.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      inst.current?.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    if (!inst.current) return;
    if (papers.length === 0) {
      inst.current.clear();
      return;
    }
    // X 轴 = 用户答过的所有年份，按升序排
    // Y 轴 0-100 分 (右 Y 轴不启用)。Tooltip 弹层里给出该年具体
    // 分项得分 + 该年广东晋级 / 全国一/二/三等线 (下钻信息)。
    //
    // 简化后 (commit on 2026-08-11) 不再画分项折线 (单项选择 / 阅读
    // 程序 / 完善程序) —— 4 条线叠在一起看不清走势, 学生真正关心的
    // 是"总分 vs 晋级线", 精简后图面只剩 1 条总分实线 + 1 条晋级虚线。
    // 分项细节 + 一/二/三等参考线挪到 tooltip 弹层里, 想看能下钻。
    const years = Array.from(new Set(papers.map((p) => p.year))).sort(
      (a, b) => a - b,
    );

    // 总分折线的数据：直接用 backend 给的 0-100 分 (score =
    // earned / max * 100)。max=0 (异常数据) 时返回 null, 自动断开。
    const totalData = years.map((y) => {
      const p = papers.find((it) => it.year === y);
      if (!p) return null;
      if (p.total.max <= 0) return null;
      return p.total.score;
    });

    // 构造 markLine 数据 —— 旧版"每年画 4 条线" (commit 23bfe81) 错
    // 误地把 4 keys * N years = 4N 条线段叠在一起, 折线被参考线完全
    // 淹没, 改用中位数 (commit 1134d4f / 98d738e) 只画 4 条。
    //
    // 进一步简化 (2026-08-11): 用户反馈 K 线图只需要"总分 + 晋级线",
    // 全国一二三等线不再画在主图里, 改在 tooltip 弹层里给出 (学生 hover
    // 某年时能看到完整对照)。这样主图只剩 1 条晋级虚线, 视觉清爽。
    const yAxisByKey = new Map<string, number>();
    {
      const arrByKey = new Map<string, number[]>();
      for (const key of SCORE_LINE_KEYS) arrByKey.set(key, []);
      for (const y of years) {
        const line = getScoreLine(y, group);
        if (!line) continue;
        for (const key of SCORE_LINE_KEYS) {
          arrByKey.get(key)!.push(line[key]);
        }
      }
      for (const key of SCORE_LINE_KEYS) {
        const arr = arrByKey.get(key)!;
        if (arr.length === 0) continue;
        arr.sort((a, b) => a - b);
        yAxisByKey.set(key, arr[Math.floor(arr.length / 2)]);
      }
    }
    const scoreLineData: any[] = [];
    // 只画"晋级"这一条参考线；一/二/三等挪到 tooltip 弹层。
    const promotionY = yAxisByKey.get('promotion');
    if (promotionY !== undefined) {
      const meta = SCORE_LINE_META.promotion;
      scoreLineData.push({
        yAxis: promotionY,
        silent: true,
        symbol: 'none',
        animation: false,
        lineStyle: {
          color: meta.color,
          width: 1.4,
          type: 'dashed',
          opacity: 0.7,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: () => meta.short,
          color: meta.color,
          fontSize: 10,
          fontWeight: 600,
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: [1, 4],
          borderRadius: 3,
        },
      });
    }

    inst.current.setOption(
      {
        animation: false,
        grid: { left: 36, right: 16, top: 28, bottom: 28 },
        legend: {
          show: false, // 只剩 1 条线 + 1 条参考线, 图例没必要
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'transparent',
          textStyle: { color: '#f8fafc', fontSize: 12 },
          axisPointer: {
            type: 'line',
            lineStyle: { color: '#cbd5e1', type: 'dashed' },
          },
          formatter: (params: any) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const year = params[0]?.axisValue;
            const paper = papers.find((p) => p.year === year);
            if (!paper) return `${year}`;
            const lines: string[] = [
              `<div style="font-weight:600;margin-bottom:4px">${year} ${group} 组 · ${
                paper.title
              }</div>`,
            ];
            const fmtPct = (earned: number, max: number) =>
              max > 0 ? `${earned} / ${max} (${Math.round((earned / max) * 100)}%)` : '—';
            // 分项得分：单项选择 / 阅读程序 / 完善程序 (下钻信息,
            // 不在主图里画线了, 全部塞进 tooltip)。
            lines.push(
              `<div style="display:flex;justify-content:space-between;gap:12px"><span>${labels.choice}</span><span>${fmtPct(
                paper.choice.earned,
                paper.choice.max,
              )}</span></div>`,
            );
            lines.push(
              `<div style="display:flex;justify-content:space-between;gap:12px"><span>${labels.read}</span><span>${fmtPct(
                paper.read.earned,
                paper.read.max,
              )}</span></div>`,
            );
            lines.push(
              `<div style="display:flex;justify-content:space-between;gap:12px"><span>${labels.perfect}</span><span>${fmtPct(
                paper.perfect.earned,
                paper.perfect.max,
              )}</span></div>`,
            );
            lines.push(
              `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;border-top:1px solid rgba(255,255,255,0.15);padding-top:4px"><span style="font-weight:600">总分</span><span style="font-weight:600">${
                paper.total.max > 0
                  ? `${paper.total.earned} / ${paper.total.max} (${paper.total.score} 分)`
                  : '—'
              }</span></div>`,
            );
            // 该年分数线对照：广东晋级 + 全国一/二/三等。
            // 主图只画晋级线, 其它三条挪到 tooltip, 这样图面不会
            // 被 4 条参考线压成"麻绳", 学生 hover 时还能看到完整对照。
            const scoreLine = getScoreLine(paper.year, group);
            if (scoreLine) {
              const gap = (current: number) =>
                current >= 0
                  ? `+${current.toFixed(1)}`
                  : current.toFixed(1);
              lines.push(
                `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);font-size:11px;opacity:0.85">`,
              );
              lines.push(
                `<div style="display:flex;justify-content:space-between;gap:12px"><span>广东晋级线</span><span>${scoreLine.promotion} （${
                  paper.total.score >= scoreLine.promotion ? '✓ 已过' : `${gap(paper.total.score - scoreLine.promotion)}`
                }）</span></div>`,
              );
              lines.push(
                `<div style="display:flex;justify-content:space-between;gap:12px"><span>全国一等线</span><span>${scoreLine.first} （${
                  paper.total.score >= scoreLine.first ? '✓ 已过' : `${gap(paper.total.score - scoreLine.first)}`
                }）</span></div>`,
              );
              lines.push(
                `<div style="display:flex;justify-content:space-between;gap:12px"><span>全国二等线</span><span>${scoreLine.second} （${
                  paper.total.score >= scoreLine.second ? '✓ 已过' : `${gap(paper.total.score - scoreLine.second)}`
                }）</span></div>`,
              );
              lines.push(
                `<div style="display:flex;justify-content:space-between;gap:12px"><span>全国三等线</span><span>${scoreLine.third} （${
                  paper.total.score >= scoreLine.third ? '✓ 已过' : `${gap(paper.total.score - scoreLine.third)}`
                }）</span></div>`,
              );
              lines.push(`</div>`);
            }
            return lines.join('');
          },
        },
        xAxis: {
          type: 'category',
          data: years.map(String),
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          interval: 25,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: '{value}',
          },
        },
        series: [
          {
            // 单条"总分"折线 —— 简化后不再画分项 (单项选择 / 阅读
            // 程序 / 完善程序) 和多档参考线 (一/二/三等), 只剩
            // "总分走势 + 晋级线", 一眼能看出差距。
            name: '总分',
            type: 'line',
            smooth: false,
            symbol: 'circle',
            symbolSize: 8,
            showSymbol: true,
            lineStyle: { color: TOTAL_COLOR, width: TOTAL_LINE_WIDTH, type: 'solid' },
            itemStyle: { color: TOTAL_COLOR, borderColor: '#fff', borderWidth: 1.5 },
            data: totalData,
            markLine: {
              symbol: 'none',
              silent: true,
              animation: false,
              data: scoreLineData,
            },
            z: 10,
          },
        ],
      },
      true,
    );
  }, [papers, labels, group]);

  if (papers.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 px-5 py-6">
        <div className="text-xs font-semibold text-slate-600 mb-1">{title}</div>
        <div className="h-[220px] flex flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500">还没有完成任何 {group} 组真题</p>
          <p className="text-xs text-slate-400 mt-1">
            下方 "{group} 组" 卡片里点开一套做一做，成绩就会出现在这里。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3">
      <div className="text-xs font-semibold text-slate-700 px-2 mb-1">{title}</div>
      <div ref={ref} style={{ width: '100%', height: 240 }} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 mt-1 text-[10px] text-slate-500">
        <span>Y 轴 0–100 分 · 实线 = 总分</span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block w-3 h-0.5"
            style={{ background: SCORE_LINE_META.promotion.color, opacity: 0.7 }}
          />
          晋级线 (取历年广东晋级线中位数)
        </span>
        <span className="text-slate-300">·</span>
        <span>hover 任一年查看分项 + 一/二/三等</span>
      </div>
    </div>
  );
}
