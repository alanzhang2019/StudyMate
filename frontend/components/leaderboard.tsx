'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Sparkles, Loader2, Flame, Trophy } from 'lucide-react';

type Scope = 'total' | 'daily';

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  completedClassrooms: number;
  perfectQuizScenes: number;
  improvedQuizScenes: number;
  score: number;
};

type LeaderboardData = {
  scope: Scope;
  entries: LeaderboardEntry[];
  totalStudents: number;
  totalCompletions: number;
  totalPerfectQuizScenes: number;
  totalImprovedQuizScenes: number;
  milestoneStudents: number;
  dayKey: string;
  computedAt: string;
};

/**
 * Public leaderboard for the /csp-lecture landing page.
 *
 * 2026-07-02 重构:
 * - 旧版本用 "podium + 4-10 列表" 双视图 — 把前 3 名横排做成"领奖台"，
 *   但产品反馈"排行榜应该竖着排列，按名词从高到低" — podium 的
 *   横向布局反而让名次顺序变得不明显。重写后整个列表统一竖排，
 *   rank 1 在最上、rank 10 在最下，前 3 名用金银铜调色板徽章
 *   突出，但**不破坏顺序**。
 * - 旧版本只展示前 10 名。这次放开：显示**所有**参与学员的排名
 *   （按当前 scope 过滤后的候选集），用 `max-h + overflow-y-auto`
 *   滚动。不会有人被隐藏，学生之间不再有"看得见 vs 看不见"的不公平。
 * - `日榜 / 总榜` tab 按学习里程碑切换：
 *   - 日榜：今天首次获得的课件完成、测验全对、订正进步记录
 *   - 总榜：累计课件完成、测验全对、订正进步记录
 *   两个 scope 的缓存分开（5min TTL），切 tab 不互相 invalidate。
 *
 * 视觉：
 * - 头部横幅：皇冠 + 标题 + tab 切换 + 实时统计
 * - 主体：单列垂直列表，每行 [名次徽章 | 姓名+小字统计 | 分数]
 *   超过一屏时列表内部滚动（max-h + overflow-y-auto）
 * - 前 3 名：渐变背景条 + 金/银/铜徽章（圆形 + 阴影）
 * - 4+ 名次：中性灰徽章
 * - hover：浅色高亮过渡
 * - 底部：分数公式说明
 */
export function Leaderboard() {
  const [scope, setScope] = useState<Scope>('total');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/csp-progress/leaderboard?scope=${scope}`,
        );
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
  }, [scope]);

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

  // Empty state: no student has earned a learning milestone in this scope.
  if (data.entries.length === 0) {
    const isDaily = data.scope === 'daily';
    return (
      <Card className="overflow-hidden border-dashed border-slate-200/60">
        <CardContent className="py-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-500 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            {isDaily ? '今天还没有新的学习里程碑' : '还没有学习成就上榜'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            完成课件、测验全对或订正进步后，学习记录会出现在这里
          </p>
        </CardContent>
      </Card>
    );
  }

  const isDaily = data.scope === 'daily';
  const summaryText = isDaily
    ? `今天 ${data.milestoneStudents} 位同学取得进展 · 完成课件 ${data.totalCompletions} · 测验全对 ${data.totalPerfectQuizScenes} · 订正进步 ${data.totalImprovedQuizScenes}`
    : `${data.milestoneStudents} 位同学取得进展 · 完成课件 ${data.totalCompletions} · 测验全对 ${data.totalPerfectQuizScenes} · 订正进步 ${data.totalImprovedQuizScenes}`;

  return (
    <Card className="overflow-hidden border-slate-200/60 shadow-sm">
      <CardContent className="p-0">
        {/* 头部横幅：标题 + tab + 实时统计 */}
        <div className="relative px-4 sm:px-5 py-3.5 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-200" />
              <span className="font-semibold text-sm tracking-wide">
                学习排行榜
              </span>
            </div>
            <span className="text-[10px] text-indigo-100/90 hidden sm:inline">
              按学习进展累计，不计在线时长
            </span>
          </div>

          {/* Tab 切换：日榜 / 总榜 */}
          <div
            className="mt-2.5 inline-flex items-center rounded-full bg-white/15 backdrop-blur p-0.5 text-[11px] font-medium"
            role="tablist"
            aria-label="排行榜时间范围"
          >
            <ScopeTab
              active={scope === 'daily'}
              onClick={() => setScope('daily')}
              icon={<Flame className="w-3 h-3" />}
              label="日榜"
            />
            <ScopeTab
              active={scope === 'total'}
              onClick={() => setScope('total')}
              icon={<Trophy className="w-3 h-3" />}
              label="总榜"
            />
          </div>

          <div className="mt-2 text-xs text-indigo-50/95 tabular-nums">
            {summaryText}
          </div>
        </div>

        {/* 竖向排行榜：rank 1 在最上，所有参与学员都显示 */}
        <ol className="divide-y divide-slate-100/80 max-h-[480px] overflow-y-auto">
          {data.entries.map((e) => (
            <LeaderboardRow key={`${data.scope}-${e.rank}`} entry={e} />
          ))}
        </ol>

        {/* 底部：展示记分依据，避免分数变成不透明的奖励。 */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 text-center tabular-nums">
          分数 = 完成课件 × 3 + 测验全对 × 1 + 订正进步 × 2{isDaily ? '（仅统计今日新达成）' : ''}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Tab 按钮 — 胶囊样式，激活态用白底 + 深色图标；
 * 未激活态用半透明白底 + hover 加深。
 */
function ScopeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-indigo-700 shadow-sm transition'
          : 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-white/80 hover:text-white hover:bg-white/10 transition'
      }
    >
      {icon}
      <span>{label}</span>
    </button>
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

      {/* 姓名 + 学习证据 */}
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
              {e.perfectQuizScenes}
            </span>
            <span>全对</span>
          </span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-slate-700">
              {e.improvedQuizScenes}
            </span>
            <span>订正进步</span>
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
