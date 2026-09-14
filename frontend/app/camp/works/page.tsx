'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Work = {
  slug: string;
  title: string;
  category: string;
  date: string;
  student: string;
  views: number;
  description: string;
  cover: string;
  className: string; // 仅用于 note 卡片的视觉 class，非学员班级
  ts: number; // 排序用时间戳
};

// 两个早期示范作品（炳炳 / 小高）为静态种子，保留在作品墙顶部；
// 其余作品来自管理后台上传并经审核（status=approved）后通过 /api/camp/works 动态拉取。
const SEED_WORKS: Work[] = [
  {
    slug: 'animal-maze-battle',
    title: '动物迷宫大乱斗',
    category: '互动游戏',
    date: '08/18',
    student: '炳炳 · 7 岁',
    views: 92,
    description:
      '这是一个动物大乱斗的世界，我们要在这个世界里寻找自己的目标，通过吞噬小卡拉米，让自己强大起来！',
    cover:
      'https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png',
    className: 'work-note work-note--yellow work-note--hero',
    ts: Date.parse('2025-08-18'),
  },
  {
    slug: 'formation-editor',
    title: 'Formation 队形编辑器',
    category: '生活工具',
    date: '07/30',
    student: '小高 · 6 岁',
    views: 228,
    description: '我们可以用它来编排生活中的队形',
    cover:
      'https://works.xgteacher.cn/media/covers/57b7dea2-a05e-4f67-9ed9-19b47bc0bda5/0df250aa-775f-416f-ba77-820aa326fa56.png',
    className: 'work-note work-note--blue work-note--side',
    ts: Date.parse('2025-07-30'),
  },
];

const VISUAL_CLASSES = [
  'work-note work-note--yellow work-note--side',
  'work-note work-note--blue work-note--side',
  'work-note work-note--yellow work-note--hero',
];

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

type DbWork = {
  id: string;
  title: string;
  studentName: string | null;
  className: string | null;
  grade: string | null;
  category: string | null;
  coverImage: string | null;
  description: string | null;
  featured?: number;
  sortOrder?: number;
  createdAt?: string | null;
};

function mapDbWork(w: DbWork, index: number): Work {
  const studentLabel = [w.studentName, w.grade]
    .filter(Boolean)
    .join(' · ');
  return {
    slug: w.id,
    title: w.title || '未命名作品',
    category: w.category || '作品',
    date: formatDate(w.createdAt),
    student: studentLabel || '匿名学员',
    views: 0,
    description: w.description || '',
    cover: w.coverImage || '',
    className: w.featured
      ? 'work-note work-note--yellow work-note--hero'
      : VISUAL_CLASSES[index % VISUAL_CLASSES.length],
    ts: w.createdAt ? Date.parse(w.createdAt) : 0,
  };
}

export default function WorksPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');
  const [liveWorks, setLiveWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/camp/works');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '获取失败');
        if (cancelled) return;
        const mapped = (json.data ?? []).map((w: DbWork, i: number) =>
          mapDbWork(w, i),
        );
        setLiveWorks(mapped);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allWorks = useMemo(
    () => [...liveWorks, ...SEED_WORKS],
    [liveWorks],
  );

  const visibleWorks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allWorks.filter((work) => {
      if (!q) return true;
      return (
        work.title.toLowerCase().includes(q) ||
        work.description.toLowerCase().includes(q) ||
        work.student.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) =>
      sort === 'latest' ? b.ts - a.ts : b.views - a.views,
    );
  }, [query, sort, allWorks]);

  return (
    <div className="works-page">
      <header className="works-header">
        <Link href="/camp" className="works-brand" aria-label="返回Alan张老师首页">
          <span className="brand-identity">
            <img
              className="brand-identity-mark"
              src="/assets/alan-avatar.png"
              alt=""
            />
            <img
              className="brand-identity-wordmark"
              src="/assets/alan-logo.svg"
              alt="Alan张老师"
            />
          </span>
        </Link>
        <nav className="works-header-actions" aria-label="作品墙导航">
          <Link href="/camp" className="page-switch-link">
            首页
          </Link>
          <Link href="/camp/conundrums" className="page-switch-link">
            真实问题库
          </Link>
          <Link href="/camp/submit" className="page-switch-link">
            我也来上传作品
          </Link>
          <Link href="/admin/login" className="site-login-link">
            教师登录
          </Link>
        </nav>
      </header>

      <section className="works-intro" aria-labelledby="works-title">
        <div className="works-intro-copy">
          <p className="works-index mono">WORK WALL / 02</p>
          <h1 id="works-title" className="works-title-single">
            孩子们的想法，贴在这里。
          </h1>
          <p>每一张便签，记录一个从想法到作品的过程。</p>
        </div>
        <aside className="works-wall-note" aria-label="作品墙说明">
          <span className="works-tape" aria-hidden="true" />
          <p className="mono">ABOUT THIS WALL</p>
          <strong>
            <span>不跟着模板做题，</span>
            <span>完成真正属于</span>
            <span>自己的项目。</span>
          </strong>
          <small>这里只展示已经审核并公开发布的真实学生作品。</small>
        </aside>
      </section>

      <section className="works-tools" aria-label="搜索与排序">
        <label className="works-search">
          <span className="sr-only">搜索作品名、学生小名或真实姓名</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
          </svg>
          <input
            type="search"
            placeholder="搜索作品名、小名或姓名"
            autoComplete="off"
            id="searchInput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="works-sort" aria-label="作品排序方式">
          <button
            type="button"
            className={sort === 'latest' ? 'active' : ''}
            aria-pressed={sort === 'latest'}
            id="sortLatest"
            onClick={() => setSort('latest')}
          >
            最新贴上
          </button>
          <button
            type="button"
            className={sort === 'hot' ? 'active' : ''}
            aria-pressed={sort === 'hot'}
            id="sortHot"
            onClick={() => setSort('hot')}
          >
            最近最热
          </button>
        </div>
      </section>

      <section className="works-wall" aria-live="polite">
        {loading ? (
          <div className="works-wall-grid">
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: '#9ca3af',
                padding: '3rem 0',
              }}
            >
              加载中…
            </div>
          </div>
        ) : loadError ? (
          <div className="works-wall-grid">
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: '#ef4444',
                padding: '3rem 0',
              }}
            >
              作品加载失败：{loadError}
            </div>
          </div>
        ) : (
          <div className="works-wall-grid" id="wallGrid">
            {visibleWorks.map((work) => (
              <Link
                key={work.slug}
                href={`/camp/work/${work.slug}`}
                className={work.className}
                aria-label={`查看作品：${work.title}`}
              >
                <span className="work-note-tape" aria-hidden="true" />
                <figure className="work-note-image">
                  {work.cover ? (
                    <img
                      src={work.cover}
                      alt={`${work.title}项目封面`}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          'none';
                      }}
                    />
                  ) : null}
                </figure>
                <div className="work-note-copy">
                  <div className="work-note-topline mono">
                    <span>{work.category}</span>
                    <span>{work.date}</span>
                  </div>
                  <h2>{work.title}</h2>
                  <p>{work.description}</p>
                  <div className="work-note-meta">
                    <span>{work.student}</span>
                    <span>
                      <svg
                        className="eye-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 256 256"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M251,123.13c-.37-.81-9.13-20.26-28.48-39.61C196.63,57.67,164,44,128,44S59.37,57.67,33.51,83.52C14.16,102.87,5.4,122.32,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212s68.63-13.66,94.48-39.51c19.36-19.35,28.12-38.79,28.49-39.61A12.08,12.08,0,0,0,251,123.13Zm-46.06,33C183.47,177.27,157.59,188,128,188s-55.47-10.73-76.91-31.88A130.36,130.36,0,0,1,29.52,128,130.45,130.45,0,0,1,51.09,99.89C72.54,78.73,98.41,68,128,68s55.46,10.73,76.91,31.89A130.36,130.36,0,0,1,226.48,128,130.45,130.45,0,0,1,204.91,156.12ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,148Z" />
                      </svg>
                      {work.views}
                    </span>
                    <span className="work-note-arrow" aria-hidden="true">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 256 256"
                        width="20"
                        height="20"
                        fill="currentColor"
                      >
                        <path d="M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {visibleWorks.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#9ca3af',
                  padding: '3rem 0',
                }}
              >
                还没有公开的作品，敬请期待。
              </div>
            ) : null}
          </div>
        )}
      </section>

      <footer className="works-footer">
        <div className="works-footer-meta">
          <span>Alan张老师 · AI 原生教育</span>
        </div>
      </footer>
    </div>
  );
}
