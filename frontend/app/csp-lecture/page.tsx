// Public landing page for the "CSP初赛要点精讲" module.
//
// Lists every classroom tagged with `collection: "csp-lecture"`
// (those that the admin uploaded through /admin/csp-lecture) so
// students can browse and play the lectures without logging in.
//
// Each card can be expanded to show its chapter list (one row per
// scene, in `scene.order` order). Clicking a chapter deep-links into
// the player at that scene via the `?scene=<order>` URL parameter
// that the classroom page honours.
//
// Reads directly from the filesystem instead of going through the
// admin API to avoid pulling admin-only auth middleware into the
// public surface. If the directory is empty, the page still renders
// with a friendly "coming soon" placeholder.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import type { Scene, Stage } from '@/lib/types/stage';
import { auth } from '@/auth';
import { ExpandChapterList } from './ExpandChapterList';
import { Leaderboard } from '@/components/leaderboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Chapter = {
  id: string;
  order: number;
  title: string;
  type: Scene['type'];
};

type Lecture = {
  id: string;
  title: string;
  description?: string;
  sceneCount: number;
  createdAt: string;
  chapters: Chapter[];
};

async function listCspLectures(): Promise<Lecture[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(CLASSROOMS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const items: Lecture[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    const filePath = path.join(CLASSROOMS_DIR, name);
    try {
      // Strip UTF-8 BOM if present — PowerShell's `ConvertTo-Json`
      // emits a BOM, and `JSON.parse` rejects it as a syntax error.
      const raw = (await fs.readFile(filePath, 'utf-8')).replace(/^\ufeff/, '');
      const data = JSON.parse(raw) as {
        id: string;
        stage: Stage;
        scenes: Scene[];
        createdAt: string;
        collection?: string;
      };
      if (data.collection !== 'csp-lecture') continue;

      // Build the chapter list. We always sort by `order` even though
      // most importers write scenes in order — defence in depth for
      // legacy / hand-edited JSONs.
      const chapters: Chapter[] = (Array.isArray(data.scenes) ? data.scenes : [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({
          id: s.id,
          order: s.order ?? 0,
          title: s.title || `第 ${s.order ?? '?'} 节`,
          type: s.type,
        }));

      items.push({
        id: data.id || id,
        title: data.stage?.name ?? '未命名课件',
        description: data.stage?.description,
        sceneCount: chapters.length,
        createdAt: data.createdAt,
        chapters,
      });
    } catch {
      // skip corrupted file
    }
  }
  // Sort by the lecture's display order. We try three patterns in
  // priority order:
  //   1. Leading "N、" or "N," at the start of the title (the author
  //      has been hand-numbering the CSP-J/S curriculum with these
  //      prefixes — most authoritative).
  //   2. "精讲N" embedded in the middle of the title (fallback for
  //      titles that haven't been re-numbered yet).
  //   3. Anything else (e.g. "CSP-J/S初赛题型一览") goes to the end
  //      with a stable secondary sort by title so the layout doesn't
  //      reshuffle on every render.
  //
  // Earlier we used `localeCompare(..., { numeric: true })` which
  // collated "网络" before "基础2" in zh-CN, putting 精讲3 ahead
  // of 精讲2 — explicitly extracting the integer is the only way
  // to get the curriculum author's intended 1, 2, 3, ... order.
  const titleOrder = (title: string): number => {
    const leading = title.match(/^\s*(\d+)\s*[,、.]\s*/);
    if (leading) return parseInt(leading[1], 10);
    const inline = title.match(/精讲\s*(\d+)/);
    if (inline) return parseInt(inline[1], 10);
    return Number.POSITIVE_INFINITY;
  };
  items.sort((a, b) => {
    const ao = titleOrder(a.title ?? '');
    const bo = titleOrder(b.title ?? '');
    if (ao !== bo) return ao - bo;
    return (a.title ?? '').localeCompare(b.title ?? '', 'zh-CN');
  });
  // DEBUG: log the resolved order so we can verify the sort is
  // actually firing on the deployed image. The user has reported
  // repeated "still not in order" complaints; this log is the
  // single source of truth for what the server thinks the
  // ordering is. Remove once the sort is confirmed.
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(
      '[csp-lecture] sorted order:',
      items.map((it) => ({
        id: it.id.slice(0, 20),
        title: it.title,
        order: titleOrder(it.title ?? ''),
      })),
    );
  }
  return items;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default async function CspLecturePage() {
  // Auth guard. /csp-lecture now requires a signed-in user so
  // we can attribute view progress to a real userId. The
  // student journey is: visit any classroom → if not signed
  // in, redirected here with `?redirect=/csp-lecture&as=student`
  // so the login page knows to set up a student account.
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/login?redirect=/csp-lecture&as=student');
  }
  const userName = (session.user as any).name ?? session.user.email ?? '同学';
  const userRole = (session.user as any).role ?? 'student';

  const lectures = await listCspLectures();
  const totalScenes = lectures.reduce((s, l) => s + l.sceneCount, 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              题
            </div>
            <span className="text-lg font-bold text-slate-800">AI 错题本</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'student' && (
            <Button asChild size="sm" variant="ghost">
              <Link href="/student/home">我的学习</Link>
            </Button>
          )}
          <span className="text-xs text-slate-500 hidden sm:inline">
            {userName}
          </span>
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline"
          >
            首页
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/mistake">立即开始</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-6 pb-12 sm:pt-10 sm:pb-16 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-indigo-700 bg-indigo-100 rounded-full px-3 py-1 mb-5">
          CSP 初赛 · 要点精讲
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
          CSP初赛要点精讲
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {lectures.length === 0
            ? '暂无课件，敬请期待。'
            : `共 ${lectures.length} 个课件 · ${totalScenes} 个讲解场景。点击任意课件展开章节，按顺序学习。`}
        </p>
      </section>

      {/*
       * Lecture grid + leaderboard in a 2-col layout (lg+).
       *
       * Why 3-col lecture grid + 1-col leaderboard on desktop:
       * the page should read as a "course catalog" first, with
       * the social-proof leaderboard pinned on the right rail.
       * On mobile (sm-) the leaderboard stacks below the
       * catalog because side-rail would be unreadable.
       *
       * Each side is independently scrollable: the
       * `lg:sticky lg:top-4` keeps the leaderboard visible
       * while the student scrolls through the lecture cards,
       * which is the whole point of putting it on the right.
       *
       * Public leaderboard. Always shown (even with zero
       * entries) so the page doesn't have an empty gap; the
       * component renders its own friendly "be the first"
       * empty state. No auth required: the server masks
       * names before responding.
       */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3">
            {lectures.length === 0 ? (
              <Card className="bg-white/70 backdrop-blur border-slate-200/60">
                <CardContent className="py-16 text-center">
                  <div className="text-5xl mb-4">📭</div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">
                    还没有课件
                  </h2>
                  <p className="text-slate-600 text-sm">
                    管理员会陆续在后台添加 CSP 初赛相关课件，先去别处转转？
                  </p>
                  <div className="mt-6">
                    <Button asChild variant="outline">
                      <Link href="/">回到首页</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {lectures.map((l) => (
                  <LectureCard key={l.id} lecture={l} />
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <Leaderboard />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div>© {new Date().getFullYear()} AI 错题本 · CSP初赛要点精讲</div>
          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-slate-900">
              首页
            </Link>
            <Link href="/mistake-book" className="hover:text-slate-900">
              错题本
            </Link>
            <Link href="/admin/csp-lecture" className="hover:text-slate-900">
              管理入口
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function LectureCard({ lecture }: { lecture: Lecture }) {
  return (
    <Card className="h-full bg-white/80 backdrop-blur border-slate-200/60 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <CardContent className="pt-6 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
            CSP初赛
          </span>
          <span className="text-xs text-slate-400">{formatDate(lecture.createdAt)}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2 line-clamp-2">
          {lecture.title}
        </h3>
        {lecture.description && (
          <p className="text-sm text-slate-600 line-clamp-3 mb-4">
            {lecture.description}
          </p>
        )}
        <div className="mt-auto">
          <ExpandChapterList lectureId={lecture.id} chapters={lecture.chapters} />
        </div>
      </CardContent>
    </Card>
  );
}
