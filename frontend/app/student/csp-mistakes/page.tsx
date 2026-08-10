// /student/csp-mistakes — 错题本页面
//
// 把当前用户在所有 CSP 课件 / 真题中答错的题目，按课件标题
// 分门别类地展示，方便复习。
//
// 数据来源：服务端直接调用 loadCspMistakeBook(userId)，与
// /api/mistake-book/csp 共用同一份聚合逻辑。
//
// UI 行为：
//  - 每个课件一张可折叠卡片
//  - 默认所有卡片展开（学生上来就应该看到错题）
//  - 提供"全部展开 / 全部折叠"快捷按钮
//  - 每道错题显示：题干、选项、你的答案（红）、正确答案（绿）、
//    解析、"去课件复习" 跳转按钮（跳到该 scene）

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { SignOutLink } from '@/components/SignOutLink';
import { Card, CardContent } from '@/components/ui/card';
import { MistakeBookView } from '@/components/mistake-book/mistake-book-view';
import {
  loadCspMistakeBook,
  type MistakeGroup,
} from '@/lib/server/csp-mistake-book';
import { formatDateBeijing } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CspMistakesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/login?redirect=/student/csp-mistakes&as=student');
  }
  const role = (session.user as any).role ?? 'student';
  if (role !== 'student') {
    redirect('/select-profile');
  }
  // next-auth Session.user.id 在类型上是 `string | undefined`,
  // 走 here 必然已登录, 加运行时守卫防止 undefined 流入聚合函数。
  const userId = session.user.id;
  if (!userId) {
    redirect('/auth/login?redirect=/student/csp-mistakes&as=student');
  }
  const userName =
    (session.user as any).name ??
    session.user.email?.split('@')[0] ??
    '同学';

  const book = await loadCspMistakeBook(userId);
  const totalCount = book.totalMistakes;
  // 各课件错题数的总和（去重后），与 totalCount 应一致
  const groupSum = book.groups.reduce((s, g) => s + g.mistakeCount, 0);
  void groupSum; // (consistency check noop; 保留变量方便后续断言)
  // 最近一次答错时间
  const lastAt = book.groups[0]?.lastMistakeAt ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-amber-50">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Link href="/student/home" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold">
              错
            </div>
            <span className="text-lg font-bold text-slate-800">我的错题本</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/csp-lecture"
            className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline"
          >
            课件库
          </Link>
          <Link
            href="/student/home"
            className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline"
          >
            我的学习
          </Link>
          <span className="text-xs text-slate-500 hidden sm:inline">
            {userName}
          </span>
          <SignOutLink
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            退出登录
          </SignOutLink>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-2 pb-8 sm:pt-6 sm:pb-12">
        <span className="inline-block text-xs font-semibold tracking-widest text-rose-700 bg-rose-100 rounded-full px-3 py-1 mb-4">
          CSP 错题本
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
          {totalCount === 0 ? '还没有错题 🎉' : `共 ${totalCount} 道错题`}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
          {totalCount === 0
            ? '所有题目都答对了，继续保持！'
            : '按课件分门别类地整理了你的错题。点击展开，复习每道题的解析；点击"去课件复习"跳回原题章节。'}
        </p>
        {lastAt && (
          <p className="mt-2 text-xs text-slate-500">
            最近一次答错：{formatDateBeijing(lastAt)}
          </p>
        )}
      </section>

      {/* Summary cards */}
      {totalCount > 0 && (
        <section className="max-w-6xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-3 gap-3 pb-6">
          <SummaryCard label="错题总数" value={`${totalCount}`} sub="道" />
          <SummaryCard
            label="覆盖课件"
            value={`${book.groups.length}`}
            sub="本"
            accent="rose"
          />
          <SummaryCard
            label="最近答错"
            value={lastAt ? formatDateBeijing(lastAt).split(' ')[0] : '—'}
            sub={lastAt ? formatDateBeijing(lastAt).split(' ')[1] ?? '' : ''}
            accent="amber"
          />
        </section>
      )}

      {/* Group list (client component for collapse/expand) */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        {book.groups.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur border-rose-200/60">
            <CardContent className="py-16 text-center">
              <div className="text-5xl mb-4">📒</div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                错题本是空的
              </h2>
              <p className="text-slate-600 text-sm">
                去做几道 CSP 课件或真题，做错的题目会自动收集在这里。
              </p>
              <div className="mt-6">
                <Link
                  href="/csp-lecture"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-4 py-2"
                >
                  去课件库 →
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <MistakeBookView groups={book.groups as MistakeGroup[]} />
        )}
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16 text-center">
        <Link
          href="/student/home"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          ← 返回我的学习
        </Link>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'rose' | 'amber';
}) {
  const accentMap: Record<string, string> = {
    rose: 'from-rose-500/10 to-rose-500/0 border-rose-200/60',
    amber: 'from-amber-500/10 to-amber-500/0 border-amber-200/60',
  };
  return (
    <div
      className={`rounded-2xl border bg-white px-4 py-3 ${
        accent ? `bg-gradient-to-br ${accentMap[accent]}` : 'border-slate-200'
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-800">{value}</span>
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}
