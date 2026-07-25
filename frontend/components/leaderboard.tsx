'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Sparkles, Loader2 } from 'lucide-react';

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  activeDays: number;
  completedClassrooms: number;
  score: number;
};

type LeaderboardData = {
  entries: LeaderboardEntry[];
  totalStudents: number;
  totalCompletions: number;
  activeStudents: number;
  computedAt: string;
};

/**
 * Public leaderboard for the /csp-lecture landing page.
 *
 * 2026-07-26 重构:
 * 旧版本用 "podium + 4-10 列表" 双视图 — 把前 3 名横排做成"领奖台"，
 * 但产品反馈"排行榜应该竖着排列，按名词从高到低" — podium 的
 * 横向布局反而让名次顺序变得不明显。重写后整个列表统一竖排，
 * rank 1 在最上、rank 10 在最下，前 3 名用金银铜调色板徽章
 * 突出，但**不破坏顺序**。
 *
 * 视觉：
 * - 头部横幅：皇冠 + 标题 + 实时统计（多少人在坚持 / 累计完成数）
 * - 主体：单列垂直列表，每行 [名次徽章 | 姓名+小字统计 | 分数]
 * - 前 3 名：渐变背景条 + 金/银/铜徽章（圆形 + 阴影）
 * - 4+ 名次：中性灰徽章
 * - hover：浅色高亮过渡
 * - 底部：分数公式说明（让数字不显得 opaque）
 */
export function Leaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/csp-progress/leaderboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LeaderboardData;
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="overflow-hidden border-slate-200/60">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载学习排行榜…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="overflow-hidden border-slate-200/60">
        <CardContent className="py-10 text-center text-slate-500 text-sm">
          排行榜加载失败{error ? `：${error}` : ''}
        </CardContent>
      </Card>
    );
  }

  // Empty state: no student has ever logged a progress row.
  // Show a CTA-style "be the first" rather than a blank card.
  if (data.entries.length === 0) {
    return (
      <Card className="overflow-hidden border-dashed border-slate-200/60">
        <CardContent className="py-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-500 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            还没有同学上榜
          </p>
          <p className="text-xs text-slate-500 mt-1">
            累计有 {data.totalStudents} 位同学注册，做完第 1 个课件就上榜首
          </p>
        </CardContent>
      </Card>
    );
  }

  // 限制显示前 10 名，剩余人数用一行省略提示收尾
  const visible = data.entries.slice(0, 10);
  const hiddenCount = data.entries.length - visible.length;

  return (
    <Card className="overflow-hidden border-slate-200/60 shadow-sm">
      <CardContent className="p-0">
        {/* 头部横幅：标题 + 实时统计 */}
        <div className="relative px-4 sm:px-5 py-3.5 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-200" />
              <span className="font-semibold text-sm tracking-wide">
                学习排行榜
              </span>
            </div>
            <span className="text-[10px] text-indigo-100/90 hidden sm:inline">
              实时同步
            </span>
          </div>
          <div className="mt-2 text-xs text-indigo-50/95 flex items-center gap-3 flex-wrap tabular-nums">
            <span>
              <span className="font-bold text-white">
                {data.activeStudents}
              </span>{' '}
              位同学在坚持
            </span>
            <span className="w-1 h-1 rounded-full bg-indigo-200/60" />
            <span>
              累计完成{' '}
              <span className="font-bold text-white">
                {data.totalCompletions}
              </span>{' '}
              个课件
            </span>
          </div>
        </div>

        {/* 竖向排行榜：rank 1 在最上 */}
        <ol className="divide-y divide-slate-100/80">
          {visible.map((e) => (
            <LeaderboardRow key={e.rank} entry={e} />
          ))}
        </ol>

        {/* 第 10 名之后有更多同学 — 给个轻提示 */}
        {hiddenCount > 0 && (
          <div className="px-4 sm:px-5 py-2.5 text-center text-[11px] text-slate-400 bg-slate-50/40">
            还有 {hiddenCount} 位同学也在努力学习中…
          </div>
        )}

        {/* 底部：分数公式 */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 text-center tabular-nums">
          分数 = 完成课件数 × 30 + 活跃天数 × 10
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 单行排行 — 三段式布局：名次徽章 / 姓名+小字 / 分数
 *
 * 视觉变体：
 * - rank 1: 金色徽章 + 浅黄渐变背景条 + 加粗名字 + 缩略皇冠角标
 * - rank 2: 银色徽章 + 浅灰渐变背景条
 * - rank 3: 铜色徽章 + 浅橙渐变背景条
 * - rank 4+: 灰色徽章 + 透明背景
 */
function LeaderboardRow({ entry: e }: { entry: LeaderboardEntry }) {
  const isTop1 = e.rank === 1;
  const isTop2 = e.rank === 2;
  const isTop3 = e.rank === 3;
  const isPodium = isTop1 || isTop2 || isTop3;

  // 整行 hover 背景 — podium 略深一点（hover 变成实色）
  const rowClass = isTop1
    ? 'bg-gradient-to-r from-amber-50/70 to-yellow-50/40 hover:from-amber-50 hover:to-yellow-50/80'
    : isTop2
      ? 'bg-gradient-to-r from-slate-50/70 to-gray-50/40 hover:from-slate-50 hover:to-gray-50/80'
      : isTop3
        ? 'bg-gradient-to-r from-orange-50/50 to-amber-50/30 hover:from-orange-50/80 hover:to-amber-50/60'
        : 'hover:bg-slate-50/60';

  // 圆形名次徽章
  const badgeClass = isTop1
    ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 text-white shadow-md ring-2 ring-amber-200/60'
    : isTop2
      ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-white shadow-md ring-2 ring-slate-200/60'
      : isTop3
        ? 'bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 text-white shadow-md ring-2 ring-orange-200/60'
        : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/60';

  return (
    <li
      className={`group flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors duration-150 ${rowClass}`}
    >
      {/* 名次徽章 */}
      <div
        className={`relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold tabular-nums ${badgeClass}`}
      >
        {e.rank}
        {/* 冠军小皇冠角标 */}
        {isTop1 && (
          <span className="absolute -top-1 -right-1 text-[10px] leading-none">
            👑
          </span>
        )}
      </div>

      {/* 姓名 + 完成/活跃 */}
      <div className="flex-1 min-w-0">
        <div
          className={`truncate ${isPodium ? 'text-sm font-semibold text-slate-900' : 'text-sm font-medium text-slate-700'}`}
        >
          {e.displayName}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-slate-700">
              {e.completedClassrooms}
            </span>
            <span>完成</span>
          </span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-slate-700">
              {e.activeDays}
            </span>
            <span>天活跃</span>
          </span>
        </div>
      </div>

      {/* 分数 */}
      <div className="text-right shrink-0 tabular-nums">
        <div
          className={`leading-none ${isTop1 ? 'text-xl font-extrabold text-amber-600' : isPodium ? 'text-base font-bold text-indigo-700' : 'text-base font-semibold text-indigo-600'}`}
        >
          {e.score}
        </div>
        <div
          className={`mt-0.5 ${isTop1 ? 'text-[10px] text-amber-500/80' : 'text-[10px] text-slate-400'}`}
        >
          分
        </div>
      </div>
    </li>
  );
}
