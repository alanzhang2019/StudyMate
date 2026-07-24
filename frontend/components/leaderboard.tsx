'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Medal, Award, Sparkles, Loader2 } from 'lucide-react';

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
 * Reads /api/csp-progress/leaderboard (no auth required; the
 * server masks names before responding). Renders a podium for
 * the top 3 + a list for ranks 4-10 + a cohort summary line.
 *
 * Why a podium + table split: a leaderboard is about
 * recognition, and recognition is hierarchically visual. A flat
 * "1, 2, 3, 4..." list buries the winners. The two-row podium
 * makes the top 3 read at a glance, then the list below gives
 * the full Top 10 in a compact, dense format that doesn't
 * stretch the page.
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
      <Card className="overflow-hidden">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载学习排行榜…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-10 text-center text-gray-500 text-sm">
          排行榜加载失败{error ? `：${error}` : ''}
        </CardContent>
      </Card>
    );
  }

  // Empty state: no student has ever logged a progress row.
  // Show a CTA-style "be the first" rather than a blank card.
  if (data.entries.length === 0) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="py-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-500 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            还没有同学上榜
          </p>
          <p className="text-xs text-gray-500 mt-1">
            累计有 {data.totalStudents} 位同学注册，做完第 1 个课件就上榜首
          </p>
        </CardContent>
      </Card>
    );
  }

  const top3 = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Cohort summary banner — one line of context above
            the podium. Stays compact so the page rhythm is
            preserved on mobile. */}
        <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 border-b border-indigo-100/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-indigo-900">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="font-semibold">学习排行榜</span>
            <span className="text-xs text-indigo-500 hidden sm:inline">
              每日活跃 + 完成课件综合分数
            </span>
          </div>
          <div className="text-xs text-indigo-700">
            <span className="font-semibold text-indigo-900">
              {data.activeStudents}
            </span>{' '}
            位同学在坚持 · 累计完成{' '}
            <span className="font-semibold text-indigo-900">
              {data.totalCompletions}
            </span>{' '}
            个课件
          </div>
        </div>

        {/* Podium: ranks 1-3. On mobile we stack vertically so
            the avatars stay large enough; on sm+ we use a 3-col
            grid with rank 2 lifted higher than 1 and 3 to
            mimic a real podium. The "lift" uses
            -translate-y-* which is cheaper than a real CSS
            transform on already-transformed card surfaces
            (we don't have transforms here so it is fine). */}
        <div className="px-4 sm:px-6 pt-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Order the podium as 2 / 1 / 3 so the winner is
                visually centred. CSS `order-` reorders without
                changing source order. */}
            {top3[1] && (
              <PodiumCard entry={top3[1]} icon={<Medal className="w-5 h-5" />} tone="silver" order="sm:order-1" />
            )}
            {top3[0] && (
              <PodiumCard entry={top3[0]} icon={<Crown className="w-5 h-5" />} tone="gold" order="sm:order-2" />
            )}
            {top3[2] && (
              <PodiumCard entry={top3[2]} icon={<Award className="w-5 h-5" />} tone="bronze" order="sm:order-3" />
            )}
          </div>
        </div>

        {/* Ranks 4-10 in a compact list. Hidden when there
            are only 3 or fewer active students. */}
        {rest.length > 0 && (
          <div className="px-4 sm:px-6 pb-4">
            <ol className="divide-y divide-gray-100">
              {rest.map((e) => (
                <li
                  key={e.rank}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="w-7 text-center text-sm font-semibold text-gray-500 tabular-nums">
                    {e.rank}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                    {e.displayName}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500">
                    <span className="tabular-nums">{e.completedClassrooms}</span>
                    <span>完成</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500">
                    <span className="tabular-nums">{e.activeDays}</span>
                    <span>天活跃</span>
                  </span>
                  <span className="w-12 text-right text-sm font-semibold text-indigo-600 tabular-nums">
                    {e.score}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Footer — explains the scoring formula so the
            numbers don't feel opaque. Hidden on very small
            screens; the podium itself is the proof. */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-50/60 border-t border-gray-100 text-[11px] text-gray-500 text-center">
          分数 = 完成课件数 × 30 + 活跃天数 × 10 · 每日学习时长上限 8 小时
        </div>
      </CardContent>
    </Card>
  );
}

function PodiumCard({
  entry,
  icon,
  tone,
  order,
}: {
  entry: LeaderboardEntry;
  icon: React.ReactNode;
  tone: 'gold' | 'silver' | 'bronze';
  order: string;
}) {
  // Tone palette — three distinct surfaces so the eye can
  // tell ranks apart at a glance. We avoid literal "gold/
  // silver/bronze" CSS colors because they clash with the
  // site's primary indigo gradient — instead each tone
  // takes the indigo base and shifts hue + saturation.
  const toneClass =
    tone === 'gold'
      ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/70 text-amber-700'
      : tone === 'silver'
        ? 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200/70 text-slate-600'
        : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200/70 text-orange-700';
  return (
    <div
      className={`relative rounded-xl border ${toneClass} p-3 ${order} ${
        tone === 'gold' ? 'sm:-translate-y-1' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            tone === 'gold'
              ? 'bg-amber-100 text-amber-600'
              : tone === 'silver'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-orange-100 text-orange-600'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">
              {entry.rank}
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {entry.displayName}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {entry.completedClassrooms} 完成 · {entry.activeDays} 天活跃
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums text-indigo-600">
            {entry.score}
          </div>
          <div className="text-[10px] text-gray-400">分</div>
        </div>
      </div>
    </div>
  );
}
