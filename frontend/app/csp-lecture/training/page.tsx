// Server-rendered listing page for the CSP-J/S training plans.
// Source: files in /public/csp-lecture/training/*.md
// Renders one card per student plan + the shared question-bank
// and calendar. **Publicly accessible** — no auth gate, so that
// 学员 / 家长通过直接分享链接就能查看训练计划。

import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Target, Users, Sparkles, ChevronRight, ListChecks, CalendarDays } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRAINING_DIR = path.join(process.cwd(), 'public', 'csp-lecture', 'training');

type Tier = 'A' | 'B' | 'C' | 'D' | 'shared';

type PlanCard = {
  slug: string;
  title: string;
  subtitle: string;       // 一行简述（梯队 / 目标 / 学员档）
  badge: string;          // 角标文字
  tier: Tier;
  goal: string;           // 目标说明, 列表展示
  topics: string[];       // 3~4 个关键词
  description: string;    // 描述
};

// 训练计划的元数据. 文件名 = slug (去 .md 后缀).
// 这里手写是因为现有 markdown 文件没有 frontmatter 头;
// 每个学员的梯队/目标信息是教练整理出来的, 需要作为元数据
// 给学员一个快速对照视图.
const PLANS: PlanCard[] = [
  {
    slug: '赵永浩',
    title: '赵永浩 · A 队 CSP-S 冲奖',
    subtitle: '初二 · AC 255 · 难度 ≥ 4 占比 78%',
    badge: '🥇 A 队',
    tier: 'A',
    goal: 'CSP-S 2026 一等奖',
    topics: ['DP', '图论', '数据结构', '数学'],
    description: '9/15 起每周 1 次 3h 课 + 国庆 5 天集训。已能稳定拿下 T1T2, T3 思路常差一步；国庆重点补状态机 + 树上倍增。',
  },
  {
    slug: '刘一乐',
    title: '刘一乐 · A 队 CSP-S 冲奖',
    subtitle: '初二 · AC 250 · 4 大思维漏洞待改造',
    badge: '🥇 A 队',
    tier: 'A',
    goal: 'CSP-S 2026 一等奖',
    topics: ['贪心证明', 'DP 状态机', '树上倍增'],
    description: 'W0 第一件事: 改掉 `#define int long long` 习惯 + 加 `ios::sync_with_stdio` + WA 后强制冷静 5 分钟。国庆 5 天每天 1.5h 专题针对其漏洞。',
  },
  {
    slug: '许立轩',
    title: '许立轩 · B 队 CSP-J 主力',
    subtitle: '初一 · AC 91 · 弱项: BFS/DFS 复杂建模',
    badge: '🥈 B 队',
    tier: 'B',
    goal: 'CSP-J 2026 一等奖',
    topics: ['BFS 建模', 'DP 入门', '贪心'],
    description: '刷题量足, 缺深度。国庆后每周加 1 道 BFS 变形 + 1 道状态 DP, 8 周内冲到 A 队。',
  },
  {
    slug: '林珅熠',
    title: '林珅熠 · B 队 CSP-J 主力',
    subtitle: '初一 · AC 115 · 强项: 字符串',
    badge: '🥈 B 队',
    tier: 'B',
    goal: 'CSP-J 2026 一等奖',
    topics: ['KMP', 'DP 状态机', '图论基础'],
    description: '字符串已能上手 KMP, 但 DP 一遇多维就崩。国庆 5 天重点练"线/区间 DP"系列。',
  },
  {
    slug: '付胤睿',
    title: '付胤睿 · B 队 CSP-J 主力',
    subtitle: '初二 · AC 79 · 复赛主冲 J 一等',
    badge: '🥈 B 队',
    tier: 'B',
    goal: 'CSP-J 2026 一等奖',
    topics: ['DP 优化', '图论', '数学'],
    description: '已能稳定上 200 分, 差 100 分到一等。国庆 5 天针对 4 道 D 类难度的 2020~2024 复赛题。',
  },
  {
    slug: '林展骥',
    title: '林展骥 · C 队 CSP-J 稳过',
    subtitle: '初二 · AC 29 · 需补刷题量',
    badge: '🥉 C 队',
    tier: 'C',
    goal: 'CSP-J 2026 二等奖',
    topics: ['基础题量', 'L2 难度', 'BFS/DFS'],
    description: '基础稳, 但 AC 总数过低。8 周内需补到 80+, 否则省一线下不稳。',
  },
  {
    slug: '边云舒',
    title: '边云舒 · C 队 CSP-J 稳过',
    subtitle: '六年级 · AC 50 · 年龄小, 节奏放慢',
    badge: '🥉 C 队',
    tier: 'C',
    goal: 'CSP-J 2026 二等奖',
    topics: ['L2 普及-', 'DP 入门', '贪心'],
    description: '六年级选手, 学习节奏要慢。每周 1 次 3h 课 + 课后 1 套 GESP 5 级真题, 不超载。',
  },
  {
    slug: '梁晋诚',
    title: '梁晋诚 · D 队 新生',
    subtitle: '初一 · AC 53 · 全部 L1, 需破 L2',
    badge: '🌱 D 队',
    tier: 'D',
    goal: 'CSP-J 2026 三等奖 / 入门',
    topics: ['L2 普及-', '递归', '基础数据结构'],
    description: '新生, 8 周内 AC 量目标: 53 → 100+。每周 1 道 L2 普及- 题 + 3 道 L1 巩固。',
  },
  {
    slug: '黄祺皓',
    title: '黄祺皓 · D 队 新生',
    subtitle: '初一 · AC 27 · 搜索 + DP 双弱',
    badge: '🌱 D 队',
    tier: 'D',
    goal: 'CSP-J 2026 三等奖 / 入门',
    topics: ['DFS/BFS', 'DP 入门', '模拟'],
    description: '8 周内 AC 量目标: 27 → 70+。国庆 5 天专攻 BFS 4 道 (迷宫 / 多源 / 双端 / 状态压缩)。',
  },
  {
    slug: '丁立轩',
    title: '丁立轩 · D 队 新生',
    subtitle: '六年级 · AC 11 · 量最少, 慢慢追',
    badge: '🌱 D 队',
    tier: 'D',
    goal: 'CSP-J 2026 三等奖 / 入门',
    topics: ['C++ 语法', '顺序/分支/循环', '基础题'],
    description: '基础最弱。8 周目标 AC 11 → 50。国庆 5 天每天做 1 道 L1 难度 + 1 道语法练习。',
  },
];

const SHARED: PlanCard[] = [
  {
    slug: '题库',
    title: '共享题库',
    subtitle: '9 大考点 · 110+ 道洛谷题号',
    badge: '📚 共享',
    tier: 'shared',
    goal: '查题 + 选题',
    topics: ['基础语法', '数据结构', '图论', '数学'],
    description: '按 A 模拟 / B 贪心 / C 搜索 / D DP / E 字符串 / F 图论 / G 数学 / H 数据结构 / I 杂项 9 大类分, 每题带洛谷直链 + 难度色标 + 训练点。',
  },
  {
    slug: '日历',
    title: '共享日历',
    subtitle: 'W0~W3 + 国庆 5 天时间线',
    badge: '📅 共享',
    tier: 'shared',
    goal: '时间安排',
    topics: ['课表', '复赛', '国庆集训'],
    description: '9/14 起 4 周 + 国庆 5 天, 每天 3h 课 + 1.5h 课后, 合计 32h/学员。',
  },
];

function tierColor(tier: Tier): { bg: string; text: string; ring: string; } {
  switch (tier) {
    case 'A': return { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200' };
    case 'B': return { bg: 'bg-sky-50',    text: 'text-sky-700',    ring: 'ring-sky-200' };
    case 'C': return { bg: 'bg-emerald-50',text: 'text-emerald-700',ring: 'ring-emerald-200' };
    case 'D': return { bg: 'bg-lime-50',   text: 'text-lime-700',   ring: 'ring-lime-200' };
    case 'shared': return { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200' };
  }
}

function PlanCardView({ plan }: { plan: PlanCard }) {
  const c = tierColor(plan.tier);
  return (
    <Link
      href={`/csp-lecture/training/${encodeURIComponent(plan.slug)}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-2xl"
      aria-label={`打开 ${plan.title}`}
    >
      <Card className={`h-full bg-white/85 backdrop-blur border-slate-200/60 ${c.ring} ring-1 hover:shadow-md hover:-translate-y-0.5 transition-all`}>
        <CardContent className="pt-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
              {plan.badge}
            </span>
            <span className="text-xs text-slate-500">{plan.subtitle}</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">
            {plan.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
            <Target className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="font-semibold text-slate-700">目标:</span>
            <span>{plan.goal}</span>
          </div>
          <p className="text-sm text-slate-600 line-clamp-3 mb-3 flex-1">
            {plan.description}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {plan.topics.map((t) => (
              <span
                key={t}
                className="inline-flex items-center text-[11px] bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-1.5 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600">
            打开计划
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function TrainingIndexPage() {
  // 公开访问: 任何用户（含未登录访客）都能查看训练计划总览。
  // 学员真实姓名 + AC 数据本身是教练已脱敏的级别信息, 适合公开
  // 分享给学员 / 家长。

  // Sanity: confirm the directory has files. We don't enumerate
  // them at request time (PLANS array is the source of truth for
  // what to show), but a missing directory is a deploy bug.
  try {
    await fs.access(TRAINING_DIR);
  } catch {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-500">
        训练计划尚未部署，请稍后再试。
      </main>
    );
  }

  const aTeam = PLANS.filter((p) => p.tier === 'A');
  const bTeam = PLANS.filter((p) => p.tier === 'B');
  const cTeam = PLANS.filter((p) => p.tier === 'C');
  const dTeam = PLANS.filter((p) => p.tier === 'D');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/40">
      {/* noindex: 训练计划含真实学员姓名/AC 统计, 不应被搜索引擎收录 */}
      <meta name="robots" content="noindex,nofollow" />

      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <Link
          href="/csp-lecture"
          className="inline-flex items-center gap-1.5 text-sm font-semibold
                     text-slate-700 hover:text-slate-900
                     bg-white/70 hover:bg-white
                     border border-slate-200 rounded-lg px-3 py-1.5
                     transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" aria-hidden="true" />
          返回 CSP 初赛通关宝典
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          王牌战队 2 · 训练计划
        </span>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          CSP-J/S 国庆集训 训练计划
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {PLANS.length} 位学员 · 按梯队分组 · W0~W3 + 国庆 5 天 · 合计 32h/学员 · 国庆 5 天后回课。
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
            🥇 A 队 · CSP-S 冲奖 ({aTeam.length})
          </span>
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 px-2 py-1 rounded-md">
            🥈 B 队 · CSP-J 主力 ({bTeam.length})
          </span>
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">
            🥉 C 队 · CSP-J 稳过 ({cTeam.length})
          </span>
          <span className="inline-flex items-center gap-1 bg-lime-100 text-lime-700 px-2 py-1 rounded-md">
            🌱 D 队 · 新生 ({dTeam.length})
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pb-12 space-y-10">
        {/* 共享资源: 题库 + 日历, 放在最前方便其他学员也查阅 */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-slate-500" aria-hidden="true" />
            共享资源
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SHARED.map((p) => <PlanCardView key={p.slug} plan={p} />)}
          </div>
        </section>

        {/* A 队 CSP-S 冲奖 */}
        {aTeam.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
              A 队 · CSP-S 冲奖
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {aTeam.map((p) => <PlanCardView key={p.slug} plan={p} />)}
            </div>
          </section>
        )}

        {/* B 队 CSP-J 主力 */}
        {bTeam.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-500" aria-hidden="true" />
              B 队 · CSP-J 主力
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {bTeam.map((p) => <PlanCardView key={p.slug} plan={p} />)}
            </div>
          </section>
        )}

        {/* C 队 CSP-J 稳过 */}
        {cTeam.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              C 队 · CSP-J 稳过
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cTeam.map((p) => <PlanCardView key={p.slug} plan={p} />)}
            </div>
          </section>
        )}

        {/* D 队 新生 */}
        {dTeam.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-lime-500" aria-hidden="true" />
              D 队 · 新生
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {dTeam.map((p) => <PlanCardView key={p.slug} plan={p} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
