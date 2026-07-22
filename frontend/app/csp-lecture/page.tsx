// Public landing page for the "CSP初赛要点精讲" module.
//
// Lists every classroom tagged with `collection: "csp-lecture"`
// (those that the admin uploaded through /admin/csp-lecture) so
// students can browse and play the lectures without logging in.
//
// Reads directly from the filesystem instead of going through the
// admin API to avoid pulling admin-only auth middleware into the
// public surface. If the directory is empty, the page still renders
// with a friendly "coming soon" placeholder.

import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import type { Stage } from '@/lib/types/stage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Lecture = {
  id: string;
  title: string;
  description?: string;
  sceneCount: number;
  createdAt: string;
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
          scenes: unknown[];
          createdAt: string;
          collection?: string;
        };
        if (data.collection !== 'csp-lecture') continue;
        items.push({
          id: data.id || id,
          title: data.stage?.name ?? '未命名课件',
          description: data.stage?.description,
          sceneCount: Array.isArray(data.scenes) ? data.scenes.length : 0,
          createdAt: data.createdAt,
        });
      } catch {
        // skip corrupted file
      }
    }
  items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
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
            : `共 ${lectures.length} 个课件 · ${totalScenes} 个讲解场景。点击任意卡片开始学习。`}
        </p>
      </section>

      {/* Lecture grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {lectures.map((l) => (
              <Link
                key={l.id}
                href={`/classroom/${l.id}`}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
              >
                <Card className="h-full bg-white/80 backdrop-blur border-slate-200/60 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <CardContent className="pt-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] uppercase tracking-wider text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        CSP初赛
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(l.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 line-clamp-2">
                      {l.title}
                    </h3>
                    {l.description && (
                      <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
                        {l.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        {l.sceneCount} 个场景
                      </span>
                      <span className="text-blue-600 group-hover:underline">
                        开始学习 →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
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
