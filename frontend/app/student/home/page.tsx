// /student/home — student dashboard.
//
// Lists the student's CSP lecture progress: in-progress
// classrooms (with coverage % and last-viewed scene), completed
// classrooms, and classrooms the student hasn't started yet.
// Each row links into the player at the last-viewed scene (or
// scene 1 if untouched).
//
// This page is server-rendered (RSC) because the data is
// strictly per-user and we want the first paint to already
// show real progress. We do NOT add a client component for
// filtering/sorting in v1 — the "most recent" / "in progress"
// sort is done in the API and is what most students will
// want anyway. A future revision can add interactive filters.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { listClassroomSummaries } from '@/lib/server/classroom-storage';
import { evaluateCompletion, type CompletionResult } from '@/lib/server/csp-completion';
import { loadCspMistakeBook } from '@/lib/server/csp-mistake-book';
import { SignOutLink } from '@/components/SignOutLink';
import { PaperScoreTrendChart } from '@/components/csp-lecture/paper-score-trend';
import { formatDateBeijing, parseStoredTimestamp } from '@/lib/utils/date';

type AuditFlag = {
  kind: string;
  at: string;
  details: Record<string, unknown>;
};

type Entry = {
  classroomId: string;
  title: string;
  totalScenes: number;
  watchedScenes?: number;
  coveragePct: number;
  watchSeconds: number;
  completed: boolean;
  lastViewedSceneId: string | null;
  lastViewedAt: string | null;
  completion: CompletionResult;
  auditFlags: AuditFlag[];
};

function safeJsonArray<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    if (parsed && typeof parsed === 'object') return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function formatDuration(s: number): string {
  if (!s || s < 0) return '0分钟';
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const d = parseStoredTimestamp(iso);
  if (!d) return '';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return formatDateBeijing(iso);
}

export default async function StudentHomePage() {
  // Auth: same as /csp-lecture, require a signed-in user. We
  // additionally enforce role === 'student' so a parent who
  // somehow lands here gets routed to the right page instead
  // of seeing an empty dashboard.
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/login?redirect=/student/home&as=student');
  }
  const role = (session.user as any).role ?? 'student';
  if (role !== 'student') {
    redirect('/select-profile');
  }
  const userId = session.user.id;
  const userName =
    (session.user as any).name ??
    session.user.email?.split('@')[0] ??
    '同学';

  const rows = db.cspProgress.findManyByUser(userId);
  const summaries = await listClassroomSummaries('csp-lecture');
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  // 错题总数（按课件 + scene + questionId 去重）。驱动顶部
  // SummaryCard 的"错题数"和 hero 文案。如果当前用户没做过题，
  // loadCspMistakeBook 直接返回 { totalMistakes: 0, groups: [] }，
  // 不会报错。
  const mistakeBook = await loadCspMistakeBook(userId);
  const mistakeCount = mistakeBook.totalMistakes;

  const inProgress: Entry[] = [];
  const completed: Entry[] = [];
  // Evaluate completion per row in parallel. Each call reads
  // the classroom JSON + this user's submissions, so it's
  // bounded by the page-cache hit rate on small directories.
  const completions = await Promise.all(
    rows.map((r) => evaluateCompletion(userId, r.classroomId)),
  );
  rows.forEach((r, i) => {
    const summary = summaryById.get(r.classroomId);
    const title = summary?.title ?? r.classroomId;
    const totalScenes = summary?.sceneCount ?? r.totalScenes;
    const viewedScenes = safeJsonArray<string[]>(r.viewedScenes, []);
    const completion = completions[i];
    const auditFlags = safeJsonArray<AuditFlag[]>(r.auditFlags, []);
    const entry: Entry = {
      classroomId: r.classroomId,
      title,
      totalScenes,
      watchedScenes: viewedScenes.length,
      coveragePct: r.coveragePct,
      watchSeconds: r.watchSeconds,
      completed: completion.completed,
      lastViewedSceneId: r.lastViewedSceneId,
      lastViewedAt: r.lastViewedAt,
      completion,
      auditFlags,
    };
    if (entry.completed) completed.push(entry);
    else inProgress.push(entry);
  });
  inProgress.sort(
    (a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''),
  );
  completed.sort(
    (a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''),
  );

  const startedIds = new Set(rows.map((r) => r.classroomId));
  const notStarted = summaries
    .filter((s) => !startedIds.has(s.id))
    .map((s) => ({
      classroomId: s.id,
      title: s.title,
      totalScenes: s.sceneCount,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));

  const summary = {
    total: summaries.length,
    completed: completed.length,
    inProgress: inProgress.length,
    totalWatchSeconds: rows.reduce((s, r) => s + (r.watchSeconds ?? 0), 0),
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Link href="/csp-lecture" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              爱
            </div>
            <span className="text-lg font-bold text-slate-800">爱讲题</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
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

      <section className="max-w-6xl mx-auto px-6 pt-4 pb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
          你好，{userName}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          这里是你的 CSP 初赛学习记录。继续上次的学习、查看错题，或者开始一个新的章节。
        </p>
      </section>

      {/* Summary cards */}
      <section className="max-w-6xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pb-8">
        <SummaryCard label="总课件" value={`${summary.total}`} sub="题" />
        <SummaryCard
          label="进行中"
          value={`${summary.inProgress}`}
          sub="个课件"
          accent="indigo"
        />
        <SummaryCard
          label="已打卡"
          value={`${summary.completed}`}
          sub="个课件"
          accent="emerald"
        />
        <SummaryCard
          label="累计学习"
          value={formatDuration(summary.totalWatchSeconds)}
          accent="violet"
        />
      </section>

      {/* 错题本入口 — 单独成块, 用玫红色与上面 4 个蓝紫调 SummaryCard
          区分。错题数 > 0 才显示, 0 时不浪费一行, 学生直接从 hero
          文案知道"还没错题"。 */}
      {mistakeCount > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-6">
          <Link
            href="/student/csp-mistakes"
            className="group block rounded-2xl border border-rose-200/80
                       bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-pink-500/5
                       px-5 py-4 sm:px-6 sm:py-5
                       hover:from-rose-500/15 hover:via-rose-500/10 hover:to-pink-500/10
                       shadow-sm hover:shadow-md
                       transition-all"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white">
                <span className="text-2xl">📒</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">
                    我的 CSP 错题本
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase
                               tracking-wider text-rose-700 bg-rose-100 border border-rose-200
                               rounded-full px-2 py-0.5"
                  >
                    {mistakeCount} 道错题
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  覆盖 {mistakeBook.groups.length} 本课件 — 按时复习，记得最牢。
                </p>
              </div>
              <div className="shrink-0 text-sm font-semibold text-rose-700 group-hover:translate-x-0.5 transition-transform">
                打开错题本 →
              </div>
            </div>
          </Link>
        </section>
      )}

      {/*
       * 历年真题成绩趋势 — K线图(4 折线) 展示学生在 24 套真题
       * 上的成绩走势,J/S 两组并排。组件内自带加载 / 空状态 /
       * 渲染三态,无数据时显示"还没完成任何历年真题"。
       * 这里 hideFooterLink=true 因为学生已经在 /student/home
       * 没必要重复 "查看历年真题" 链接。
       */}
      <section className="max-w-6xl mx-auto px-6 pb-6">
        <PaperScoreTrendChart hideFooterLink />
      </section>

      {/* In progress */}
      <Section title="进行中" empty="还没有开始任何课件。去课件库挑一个感兴趣的开始吧。">
        {inProgress.map((e) => (
          <ClassroomRow
            key={e.classroomId}
            entry={e}
            ctaLabel={e.lastViewedSceneId ? '继续学习' : '开始学习'}
          />
        ))}
      </Section>

      {/* Completed */}
      <Section title="已完成" empty={null}>
        {completed.map((e) => (
          <ClassroomRow
            key={e.classroomId}
            entry={e}
            ctaLabel="重新学习"
            completed
          />
        ))}
      </Section>

      {/* Not started */}
      <Section title="未开始" empty={null}>
        {notStarted.map((e) => (
          <NotStartedRow
            key={e.classroomId}
            classroomId={e.classroomId}
            title={e.title}
            totalScenes={e.totalScenes}
          />
        ))}
      </Section>

      <section className="max-w-6xl mx-auto px-6 pb-16 pt-6 text-center">
        <Link
          href="/csp-lecture"
          className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← 返回课件库
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
  accent?: 'indigo' | 'emerald' | 'violet';
}) {
  const accentMap: Record<string, string> = {
    indigo: 'from-indigo-500/10 to-indigo-500/0 border-indigo-200/60',
    emerald: 'from-emerald-500/10 to-emerald-500/0 border-emerald-200/60',
    violet: 'from-violet-500/10 to-violet-500/0 border-violet-200/60',
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

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.filter(Boolean).length > 0;
  return (
    <section className="max-w-6xl mx-auto px-6 pb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      {has ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
      ) : (
        empty && (
          <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 px-5 py-6">
            {empty}
          </p>
        )
      )}
    </section>
  );
}

function ClassroomRow({
  entry,
  ctaLabel,
  completed,
}: {
  entry: Entry;
  ctaLabel: string;
  completed?: boolean;
}) {
  const pct = Math.round(entry.coveragePct * 100);
  const completion = entry.completion;
  // Resume-link deep-links to the last scene the student
  // watched. We pass `?resume=1` so the classroom page can
  // auto-skip the prologue and drop the student where they
  // left off (a future improvement — the parameter is
  // currently a no-op on the player, but the URL is now
  // shareable so a teacher can hand a student a "resume"
  // link to a specific scene).
  const resumeHref = entry.lastViewedSceneId
    ? `/classroom/${entry.classroomId}?scene=${encodeURIComponent(entry.lastViewedSceneId)}&resume=1`
    : `/classroom/${entry.classroomId}`;

  // CTA label adapts to the "unfinished reason" so the
  // student knows what to do next without reading the body
  // text. Priority: quiz failures > progress shortfall >
  // generic "continue". Once completed, the parent passes a
  // custom label (eg "重新学习") which we keep verbatim.
  const adaptiveLabel = completed
    ? ctaLabel
    : !completion.quizzesMet
      ? '去刷题'
      : !completion.progressMet
        ? '继续观看'
        : ctaLabel;

  // Audit-flag derived indicators. Currently we only surface
  // `suspicious_jump` (coveragePct increased >30% in <60s —
  // see /api/csp-progress/scene-complete). Other kinds in the
  // array are ignored for now; new kinds can be added here.
  const suspiciousJump = entry.auditFlags.find((f) => f.kind === 'suspicious_jump');
  const suspiciousDelta = Number(suspiciousJump?.details?.coverageDelta ?? 0);
  const suspiciousElapsed = Number(suspiciousJump?.details?.elapsedSec ?? 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800 truncate">
            {entry.title}
          </h3>
          {completed && (
            <span
              data-testid="punch-in-badge"
              className="text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5"
            >
              完成打卡
            </span>
          )}
          {!completed && completion.quizScenesCount > 0 && (
            <span
              data-testid="quiz-pill"
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                completion.quizzesMet
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}
            >
              做题 {completion.passedQuizCount}/{completion.quizScenesCount} 通过
            </span>
          )}
          {suspiciousJump && (
            <span
              data-testid="audit-warning"
              title={`检测到异常完成: ${suspiciousElapsed}s 内进度暴增 ${Math.round(
                suspiciousDelta * 100,
              )}%。建议重新认真完成本课件。`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 cursor-help"
            >
              <span aria-hidden>⚠</span>
              可疑完成
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span>
            {entry.watchedScenes ?? 0}/{entry.totalScenes} 节
          </span>
          <span>·</span>
          <span>{formatDuration(entry.watchSeconds)}</span>
          {entry.lastViewedAt && (
            <>
              <span>·</span>
              <span>{formatRelative(entry.lastViewedAt)}</span>
            </>
          )}
        </div>
        {/* Unfinished reasons (amber hint). Only shown when
            the row is NOT completed. Skip the hint when the
            student has simply not started (0 节 watched, no
            quiz attempts) — the CTA + section title is
            enough. */}
        {!completed && completion.reasons.length > 0 && (entry.watchedScenes ?? 0) > 0 && (
          <div
            data-testid="unfinished-reasons"
            className="mt-2 flex items-center gap-1 text-[11px] text-amber-700"
          >
            <span className="font-semibold">差：</span>
            {completion.reasons.map((r) => (
              <span
                key={r}
                className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5"
              >
                {r}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <a
        href={resumeHref}
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        {adaptiveLabel} →
      </a>
    </div>
  );
}

function NotStartedRow({
  classroomId,
  title,
  totalScenes,
}: {
  classroomId: string;
  title: string;
  totalScenes: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
        <div className="mt-1 text-xs text-slate-500">{totalScenes} 节</div>
      </div>
      <a
        href={`/classroom/${classroomId}`}
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        开始 →
      </a>
    </div>
  );
}
