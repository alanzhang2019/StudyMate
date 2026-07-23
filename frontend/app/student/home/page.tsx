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
};

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
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
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

  const inProgress: Entry[] = [];
  const completed: Entry[] = [];
  for (const r of rows) {
    const summary = summaryById.get(r.classroomId);
    const title = summary?.title ?? r.classroomId;
    const totalScenes = summary?.sceneCount ?? r.totalScenes;
    let viewedScenes: string[] = [];
    try {
      const arr = JSON.parse(r.viewedScenes || '[]');
      viewedScenes = Array.isArray(arr) ? arr : [];
    } catch {
      viewedScenes = [];
    }
    const entry: Entry = {
      classroomId: r.classroomId,
      title,
      totalScenes,
      watchedScenes: viewedScenes.length,
      coveragePct: r.coveragePct,
      watchSeconds: r.watchSeconds,
      completed: !!r.completedAt,
      lastViewedSceneId: r.lastViewedSceneId,
      lastViewedAt: r.lastViewedAt,
    };
    if (entry.completed) completed.push(entry);
    else inProgress.push(entry);
  }
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
              题
            </div>
            <span className="text-lg font-bold text-slate-800">AI 错题本</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline">
            {userName}
          </span>
          <Link
            href="/api/auth/signout"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            退出登录
          </Link>
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
          label="已完成"
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
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-800 truncate">
            {entry.title}
          </h3>
          {completed && (
            <span className="text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
              已完成
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
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
        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href={resumeHref}
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        {ctaLabel} →
      </Link>
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
      <Link
        href={`/classroom/${classroomId}`}
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        开始 →
      </Link>
    </div>
  );
}
