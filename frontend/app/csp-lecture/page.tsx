// Public landing page for the "CSP初赛要点精讲" module.
//
// Lists classrooms that should appear on the public CSP module page:
//   1. Classrooms tagged with `collection: "csp-lecture"` (the
//      authoritative "this is CSP courseware" signal — uploaded
//      through /admin/csp-lecture).
//   2. Legacy classrooms with no `collection` field at all. The
//      collection tag was added partway through the CSP rollout, so
//      older uploads (which are still legitimate CSP content) are
//      untagged. Hiding them here would be a regression — we want
//      every CSP classroom the admin uploaded to be visible to
//      students. Classrooms with an explicit *other* collection
//      (e.g. tagged for some other module) are still excluded so
//      the CSP page doesn't accidentally leak content from
//      unrelated modules.
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
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';
import { Printer, Trophy, ExternalLink, ArrowRight, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import type { Scene, Stage } from '@/lib/types/stage';
import { auth } from '@/auth';
import { ExpandChapterList } from './ExpandChapterList';
import { Leaderboard } from '@/components/leaderboard';
import { PlacementBanner } from '@/components/csp-lecture/PlacementBanner';
import { LectureGroup } from '@/components/csp-lecture/lecture-group';
import { formatDateBeijing } from '@/lib/utils/date';

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
  // Dedupe by stage name. The admin uploader has historically
  // produced duplicate CSP要点精讲 classrooms (same content,
  // different IDs — once as `cm_imp_a39914d3af5c64d6` tagged
  // `csp-lecture`, once as `cm_imp_b10718503e3a9777` left
  // untagged). Showing both as separate cards looked broken,
  // so we keep the first one encountered per stage.name.
  const seenNames = new Set<string>();
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
      // Only show classrooms explicitly tagged as csp-lecture.
      // The legacy "no collection ⇒ show it" fallback used to
      // pull in every per-student "错题讲解" classroom (~200
      // cards) and made the page look chaotic. Student-generated
      // error-review decks now live on /student/home, not here.
      if (data.collection !== 'csp-lecture') continue;
      const stageName = data.stage?.name ?? '未命名课件';
      if (seenNames.has(stageName)) continue;
      seenNames.add(stageName);

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

  // Group lectures into two buckets the page can render
  // separately. A previous version laid all classrooms (课件
  // 精讲 + 真题 + per-student 错题讲解 ~200 张) in one flat
  // grid, which looked chaotic. The two-bucket layout mirrors
  // the actual curriculum structure: 精讲 = conceptual
  // building blocks, 真题 = timed practice.
  //
  // Bucket assignment is ID-driven rather than title-driven so
  // renames don't break the grouping.
  type Bucket = 'primer' | 'paper';
  const bucketOf = (id: string): Bucket =>
    id.startsWith('cm_imp_cspj') ? 'paper' : 'primer';
  const primerLectures = lectures.filter((l) => bucketOf(l.id) === 'primer');
  const paperLectures = lectures.filter((l) => bucketOf(l.id) === 'paper');

  // PDF 真题卷打印链接。打包到 public/ 后, 浏览器打开即可
  // 用 Ctrl+P 打印。文件名不带中文路径, 避免部分环境编码问题。
  const paperPdfHref: Record<string, string> = {
    cm_imp_cspj2024j_v1: '/csp-j-2024-original.pdf',
    cm_imp_cspj2025j_v1: '/csp-j-2025-original.pdf',
  };

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
          {userRole === 'student' && (
            <a
              href="/student/csp-mistakes"
              className="inline-flex items-center gap-1.5 text-sm font-semibold
                         text-rose-700 bg-rose-50 hover:bg-rose-100
                         border border-rose-200 rounded-lg px-3 py-1.5
                         transition-colors"
              aria-label="打开我的 CSP 错题本"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              我的错题本
            </a>
          )}
          <a
            href="https://oi.aijiangti.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold
                       text-white bg-gradient-to-r from-fuchsia-500 via-purple-500
                       to-indigo-500 hover:from-fuchsia-600 hover:via-purple-600
                       hover:to-indigo-600 rounded-lg px-3 py-1.5
                       shadow-md hover:shadow-lg
                       ring-1 ring-purple-300/60
                       transition-all"
            aria-label="打开 OI 题库（新窗口）"
          >
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            OI 题库
            <ExternalLink className="w-3 h-3 opacity-80" aria-hidden="true" />
          </a>
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

      {/*
       * OI 题库横幅 — 醒目紫色渐变条, 放在页面第二屏
       * （地图下方、hero 上方）告诉学生"想要刷题来 oi.aijiangti.cn"。
       * 选用 gradient + trophy 图标 + "限时免费"角标, 在视觉权重上
       * 高于其他普通链接, 是本页面次级 CTA。
       */}
      <section className="max-w-6xl mx-auto px-6 pt-4">
        <a
          href="https://oi.aijiangti.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="group block relative overflow-hidden rounded-2xl
                     bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600
                     px-6 py-5 sm:px-8 sm:py-6
                     shadow-lg hover:shadow-2xl
                     ring-1 ring-white/20
                     transition-all hover:-translate-y-0.5"
        >
          {/* 装饰光晕 — 右上角斜向光斑, 让横幅不显得呆板 */}
          <div
            className="pointer-events-none absolute -top-12 -right-10 w-64 h-64
                       rounded-full bg-white/15 blur-2xl
                       group-hover:bg-white/25 transition-colors"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-4 flex-wrap">
            <div
              className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl
                         bg-white/15 backdrop-blur flex items-center justify-center
                         ring-1 ring-white/30"
            >
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-200" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  CSP 配套题库 · oi.aijiangti.cn
                </h2>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider
                             bg-yellow-300 text-purple-900 rounded-full
                             px-2 py-0.5"
                >
                  限时免费
                </span>
              </div>
              <p className="mt-1 text-sm text-white/85 leading-relaxed">
                历年 OI 真题 + 按知识点分组的练习题，做完精讲和真题后直接去刷题巩固。
              </p>
            </div>
            <div
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold
                         text-purple-700 bg-white hover:bg-yellow-50
                         rounded-lg px-4 py-2 shadow-sm
                         group-hover:translate-x-0.5 transition-transform"
            >
              立即打开
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
        </a>
      </section>

      {/*
       * CSP 晋级难度地图 — 放在页面最开头, 让新学生先看到自己所在省份
       * 的晋级难度, 带着"为什么要学 CSP"的动机再开始看下面的课件.
       *
       * 源文件: docs/CSP初赛难度地图.png, 静态复制到 public/csp-difficulty-map.png
       * (用 next/image 走默认 loader, 不需要 next.config 配置 remotePatterns).
       * 原图 1080x768, 用 object-contain + 居中, 移动端会按比例缩.
       */}
      <section className="max-w-4xl mx-auto px-6 pt-8 pb-6">
        <figure className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur">
          <Image
            src="/csp-difficulty-map.png"
            alt="CSP-J/S 2025 各省初赛晋级难度地图，颜色越深晋级率越低"
            width={1080}
            height={768}
            className="block h-auto w-full"
            priority
            sizes="(max-width: 896px) 100vw, 896px"
          />
          <figcaption className="border-t border-slate-200/60 bg-slate-50/70 px-4 py-2 text-xs text-slate-600">
            CSP-J/S 2025 各省初赛晋级难度地图 · 颜色越深表示晋级率越低（数据来源：边界数据来源·高德DataV·图易数据·noi.cn）
          </figcaption>
        </figure>
      </section>

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
            : `${primerLectures.length} 个精讲课件 · ${paperLectures.length} 套历年真题 · 共 ${totalScenes} 个章节。先精讲后真题，按顺序学完最有效。`}
        </p>
      </section>

      {/* Placement banner (摸底入口). Renders above the catalog so
          the survey CTA is the first thing a new student sees. The
          banner is a client component that owns its own loading/
          submitted/empty state. */}
      <PlacementBanner />

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
              <div className="space-y-10">
                {/* 类别 1: CSP要点精讲。 单卡片横跨整列, 让学生
                    集中在一个核心课件上; 章节目录仍可通过
                    ExpandChapterList 展开, 不会一上来就被 16 个
                    章节卡挤满屏幕。 */}
                {primerLectures.length > 0 && (
                  <LectureGroup
                    title="CSP要点精讲"
                    subtitle="按顺序学完 16 个核心概念章节，建立 CSP 初赛知识框架。"
                    accentClass="from-indigo-500/15 to-blue-500/5 border-indigo-200/60"
                    badgeClass="bg-indigo-100 text-indigo-700"
                    count={primerLectures.length}
                    countLabel="个课件"
                  >
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {primerLectures.map((l) => (
                        <LectureCard key={l.id} lecture={l} />
                      ))}
                    </div>
                  </LectureGroup>
                )}

                {/* 类别 2: 历年真题。 2024/2025 各自一张大卡,
                    卡片下方提供"打印 PDF 真题卷"按钮, 让学生
                    想要做纸质卷时一键拿到原始 PDF。 */}
                {paperLectures.length > 0 && (
                  <LectureGroup
                    title="历年真题"
                    subtitle="按年份做完整模拟卷，单选 / 阅读 / 完善程序 100 分制严格评分。"
                    accentClass="from-rose-500/15 to-amber-500/5 border-rose-200/60"
                    badgeClass="bg-rose-100 text-rose-700"
                    count={paperLectures.length}
                    countLabel="套真题"
                  >
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {paperLectures.map((l) => (
                        <PaperLectureCard
                          key={l.id}
                          lecture={l}
                          pdfHref={paperPdfHref[l.id]}
                        />
                      ))}
                    </div>
                  </LectureGroup>
                )}
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
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-5 text-sm text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} 爱讲题 · 用户可创建个人学习课件，用于教学或者学习记录</div>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200/70 text-xs text-slate-500">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1">
              <span>办公地址：深圳市龙岗区南湾街道樟富北路8号3-6</span>
              <span>
                联系电话：
                <a href="tel:0755-86993610" className="hover:text-slate-900">
                  0755-86993610
                </a>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true">🛡</span>
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900"
              >
                粤ICP备2023157905号
              </a>
            </div>
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
          <span className="text-xs text-slate-400">{formatDateBeijing(lecture.createdAt)}</span>
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

/**
 * Section banner that wraps a group of related lecture cards
 * ("CSP要点精讲" or "历年真题"). The title + one-line subtitle
 * sits above the grid so the page reads as a curriculum outline
 * instead of a single undifferentiated mass of 200+ cards.
 *
 * The `accentClass` controls the gradient strip + border colour
 * so each group has a distinct visual identity at a glance.
 *
 * The actual implementation is a client component at
 * components/csp-lecture/lecture-group.tsx so the collapse
 * animation + `useState` can run in the browser. We import
 * the same name above; this JSDoc lives on the page only
 * to document the props the call sites use.
 */


/**
 * 真题卡：复用 LectureCard 的章节展开 + 从头学习按钮,
 * 额外在卡片底部追加"打印 PDF 真题卷"按钮。按钮 href
 * 指向 /public 下的原始 PDF, 浏览器会调用内置 PDF 阅读器,
 * 学生再按 Ctrl+P 即可打印（不需要服务器端转换）。
 */
function PaperLectureCard({
  lecture,
  pdfHref,
}: {
  lecture: Lecture;
  pdfHref?: string;
}) {
  return (
    <Card className="h-full bg-white/85 backdrop-blur border-rose-200/60 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <CardContent className="pt-6 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
            历年真题
          </span>
          <span className="text-xs text-slate-400">{formatDateBeijing(lecture.createdAt)}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2 line-clamp-2">
          {lecture.title}
        </h3>
        {lecture.description && (
          <p className="text-sm text-slate-600 line-clamp-3 mb-4">
            {lecture.description}
          </p>
        )}
        <div className="mt-auto space-y-3">
          <ExpandChapterList lectureId={lecture.id} chapters={lecture.chapters} />
          {pdfHref && (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full text-sm
                         font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100
                         border border-rose-200 rounded-lg px-3 py-2
                         transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`打印 ${lecture.title} 原始 PDF 真题卷`}
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              打印 PDF 真题卷
              <span className="text-[10px] font-normal text-rose-500/80 ml-1">
                (新窗口打开后按 Ctrl+P)
              </span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
