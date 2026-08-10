'use client';

// /components/csp-lecture/paper-score-trend.tsx
//
// 历年真题成绩趋势图。
//
// 数据来源：/api/csp-quiz/paper-trend (返回当前用户答过的所有
// 24 套历年真题 J/S 的 per-category 得分)。图表分两张子图（J 组
// 和 S 组）左右并排，每张子图 4 条折线：
//   - 单项选择题（蓝）
//   - 阅读程序题（绿）
//   - 完善程序题（橙）
//   - 总分（深紫，加粗）
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
// 4 条线均为左 Y 轴 0-100 分；右 Y 轴不启用。Tooltip 默认 trigger:
// 'axis'，鼠标 hover 任何一年会同时显示 4 条线该年的得分（点
// 击穿透到对应卷子的链接行为不在此实现，避免图表成为跳转器干扰
// 阅读趋势——学生要看具体某年分数直接下拉到下方 24 张卡片）。

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
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  SVGRenderer,
]);

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

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  choice: '#3b82f6',   // blue-500
  read: '#10b981',     // emerald-500
  perfect: '#f59e0b',  // amber-500
};

const TOTAL_COLOR = '#7c3aed'; // violet-600

const CATEGORY_LINE_WIDTH: Record<CategoryKey, number> = {
  choice: 2,
  read: 2,
  perfect: 2,
};
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
              共完成 {totalAttempted} 套真题 · 折线显示单项选择 / 阅读程序 /
              完善程序 / 总分 4 个维度的得分随年份变化
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
    const years = Array.from(new Set(papers.map((p) => p.year))).sort(
      (a, b) => a - b,
    );

    // Y 轴的最大值：根据 paper-standard 满分决定 —— J 组标准满分
    // 100、S 组标准满分 100，4 条折线都是 0-100 分量纲，所以 Y 轴
    // 统一 0-100。Tooltips 会显示具体分数。
    const buildSeries = (
      key: CategoryKey,
      color: string,
      lineWidth: number,
      isTotal: boolean,
    ) => ({
      name: isTotal ? '总分' : labels[key],
      type: 'line' as const,
      smooth: false,
      symbol: 'circle',
      symbolSize: isTotal ? 8 : 6,
      showSymbol: true,
      lineStyle: { color, width: lineWidth, type: isTotal ? 'solid' : 'dashed' },
      itemStyle: { color, borderColor: '#fff', borderWidth: 1.5 },
      // total 直接用 paperHistory 给的 score；其他 3 个用
      // 0-100 折算（避免满分不等于 100 的卷子被压扁）。当 max=0
      // （早期卷子没 category）显示 null，会自动断开折线。
      data: years.map((y) => {
        const p = papers.find((it) => it.year === y);
        if (!p) return null;
        if (isTotal) {
          // total 已经是百分制（score = earned / max * 100）
          return p.total.max > 0 ? p.total.score : null;
        }
        if (p[key].max <= 0) return null;
        return Math.round((p[key].earned / p[key].max) * 10000) / 100;
      }),
      z: isTotal ? 10 : 1,
    });

    inst.current.setOption(
      {
        animation: false,
        grid: { left: 36, right: 16, top: 36, bottom: 28 },
        legend: {
          show: papers.length > 0,
          top: 0,
          left: 0,
          textStyle: { color: '#475569', fontSize: 11 },
          itemWidth: 14,
          itemHeight: 8,
          itemGap: 10,
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
          buildSeries('choice', CATEGORY_COLORS.choice, CATEGORY_LINE_WIDTH.choice, false),
          buildSeries('read', CATEGORY_COLORS.read, CATEGORY_LINE_WIDTH.read, false),
          buildSeries('perfect', CATEGORY_COLORS.perfect, CATEGORY_LINE_WIDTH.perfect, false),
          buildSeries('choice', TOTAL_COLOR, TOTAL_LINE_WIDTH, true),
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
      <div className="text-[10px] text-slate-400 px-2 mt-1">
        Y 轴 0–100 分 · 实线 = 总分，虚线 = 各题型
      </div>
    </div>
  );
}
