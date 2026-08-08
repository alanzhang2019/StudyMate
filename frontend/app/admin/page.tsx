'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Stats = {
  totals: Record<string, number>;
  series: { date: string; counts: Record<string, number> }[];
  uniqueVisitors: number;
  visitorSeries: { date: string; uv: number }[];
  windowDays: number;
};

const EVENT_LABELS: Record<string, { label: string; emoji: string }> = {
  'mistake.extract': { label: '错题识别', emoji: '📸' },
  'mistake.session.analyze': { label: '错题分析', emoji: '🧠' },
  'mistake.session.generate_classroom': { label: '讲解生成', emoji: '🎬' },
  'mistake.session.create': { label: '会话创建', emoji: '📝' },
  'admin.login': { label: '管理员登录', emoji: '🔐' },
  'landing.cta_click': { label: '首页 CTA', emoji: '👆' },
};

const PRIORITY_EVENTS = [
  'mistake.extract',
  'mistake.session.analyze',
  'mistake.session.generate_classroom',
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  // 30-day max for the headline KPI
  const totals = stats?.totals ?? {};
  const priorityTotals = PRIORITY_EVENTS.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e] = totals[e] ?? 0;
      return acc;
    },
    {},
  );

  // PV = total events, UV = unique visitors in the same window.
  // We compare against the previous day to make the trend obvious
  // without a chart library.
  const totalPV = Object.values(totals).reduce((s, n) => s + n, 0);
  const totalUV = stats?.uniqueVisitors ?? 0;
  const visitorSeries = stats?.visitorSeries ?? [];
  const todayUV = visitorSeries[visitorSeries.length - 1]?.uv ?? 0;
  const yesterdayUV =
    visitorSeries[visitorSeries.length - 2]?.uv ?? 0;
  const uvDelta =
    yesterdayUV === 0
      ? null
      : ((todayUV - yesterdayUV) / yesterdayUV) * 100;

  // Build a tiny SVG sparkline from the 30-day series so the dashboard
  // has some visual signal without dragging in a chart library.
  const sparkline = (() => {
    if (!stats) return null;
    const max = Math.max(
      1,
      ...stats.series.map((d) =>
        Object.values(d.counts).reduce((s, n) => s + n, 0),
      ),
    );
    const W = 600;
    const H = 80;
    const step = W / Math.max(1, stats.series.length - 1);
    const points = stats.series
      .map((d, i) => {
        const total = Object.values(d.counts).reduce((s, n) => s + n, 0);
        const x = i * step;
        const y = H - (total / max) * (H - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { W, H, points, max };
  })();

  // Second sparkline for UV (independent scale).
  const uvSparkline = (() => {
    if (!stats || visitorSeries.length === 0) return null;
    const max = Math.max(1, ...visitorSeries.map((d) => d.uv));
    const W = 600;
    const H = 80;
    const step = W / Math.max(1, visitorSeries.length - 1);
    const points = visitorSeries
      .map((d, i) => {
        const x = i * step;
        const y = H - (d.uv / max) * (H - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { W, H, points, max };
  })();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">数据看板</h1>
        <Badge variant="secondary">近 30 天</Badge>
      </div>

      {loading ? (
        <div className="text-gray-500 py-8">正在加载数据…</div>
      ) : error ? (
        <div className="text-red-500 py-8">{error}</div>
      ) : (
        <>
          {/* Headline: 30-day UV/PV. UV is the north star for a
              no-signup product — it tells us how many real humans
              we reached. PV is downstream of UV and event volume. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-1">👥</div>
                <div className="text-sm text-gray-500">
                  独立访客（30 天）
                </div>
                <div className="text-4xl font-semibold text-gray-900 mt-1">
                  {totalUV}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  今日 {todayUV} · 昨日 {yesterdayUV}
                  {uvDelta !== null
                    ? ` · ${uvDelta >= 0 ? '+' : ''}${uvDelta.toFixed(0)}%`
                    : ''}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-1">⚡</div>
                <div className="text-sm text-gray-500">
                  行为事件（30 天）
                </div>
                <div className="text-4xl font-semibold text-gray-900 mt-1">
                  {totalPV}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  PV · 含埋点全部
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-1">🎯</div>
                <div className="text-sm text-gray-500">人均行为</div>
                <div className="text-4xl font-semibold text-gray-900 mt-1">
                  {totalUV === 0
                    ? '0'
                    : (totalPV / totalUV).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  PV / UV · 用户活跃度
                </div>
              </CardContent>
            </Card>
          </div>

          {/* UV trend */}
          <Card>
            <CardHeader>
              <CardTitle>独立访客趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {uvSparkline ? (
                <svg
                  viewBox={`0 0 ${uvSparkline.W} ${uvSparkline.H}`}
                  className="w-full h-20"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={uvSparkline.points}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              <div className="text-xs text-gray-400 mt-2 flex justify-between">
                <span>30 天前</span>
                <span>今天</span>
              </div>
            </CardContent>
          </Card>

          {/* Priority KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PRIORITY_EVENTS.map((evt) => {
              const meta = EVENT_LABELS[evt];
              return (
                <Card key={evt}>
                  <CardContent className="pt-6">
                    <div className="text-3xl mb-1">{meta.emoji}</div>
                    <div className="text-sm text-gray-500">{meta.label}</div>
                    <div className="text-3xl font-semibold text-gray-900 mt-1">
                      {priorityTotals[evt]}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Trend */}
          <Card>
            <CardHeader>
              <CardTitle>每日活跃事件</CardTitle>
            </CardHeader>
            <CardContent>
              {sparkline ? (
                <svg
                  viewBox={`0 0 ${sparkline.W} ${sparkline.H}`}
                  className="w-full h-20"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={sparkline.points}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              <div className="text-xs text-gray-400 mt-2 flex justify-between">
                <span>30 天前</span>
                <span>今天</span>
              </div>
            </CardContent>
          </Card>

          {/* All event totals */}
          <Card>
            <CardHeader>
              <CardTitle>所有事件（30 天）</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(totals).length === 0 ? (
                <div className="text-gray-500 py-4">
                  暂无数据。说明还没有真实用户使用，推广或流程可能需要调整。
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(totals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([evt, n]) => {
                      const meta = EVENT_LABELS[evt] ?? {
                        label: evt,
                        emoji: '•',
                      };
                      return (
                        <div
                          key={evt}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span>{meta.emoji}</span>
                            <span className="text-gray-700">{meta.label}</span>
                            <code className="text-xs text-gray-400">
                              {evt}
                            </code>
                          </div>
                          <div className="font-mono font-semibold text-gray-900">
                            {n}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
