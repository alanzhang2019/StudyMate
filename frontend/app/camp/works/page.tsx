'use client';

import { useMemo, useState } from 'react';
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
  className: string;
  order: number;
};

const WORKS: Work[] = [
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
    order: 0,
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
    order: 1,
  },
];

export default function WorksPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');

  const visibleWorks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = WORKS.filter((work) => {
      if (!q) return true;
      return (
        work.title.toLowerCase().includes(q) ||
        work.description.toLowerCase().includes(q) ||
        work.student.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) =>
      sort === 'latest' ? a.order - b.order : b.views - a.views
    );
  }, [query, sort]);

  return (
    <div className="works-page">
      <header className="works-header">
        <Link href="/camp" className="works-brand" aria-label="返回Alan张老师首页">
          <span className="brand-identity">
            <img
              className="brand-identity-mark"
              src="https://edu.xgteacher.cn/assets/xgls-avatar.jpg"
              alt=""
            />
            <img
              className="brand-identity-wordmark"
              src="https://edu.xgteacher.cn/assets/xgls-logo.png"
              alt="Alan张老师"
            />
          </span>
        </Link>
        <nav className="works-header-actions" aria-label="作品墙导航">
          <Link href="/camp" className="page-switch-link">
            首页
          </Link>
          <Link href="/admin/login" className="site-login-link">
            教师登录
          </Link>
        </nav>
      </header>

      <section className="works-intro" aria-labelledby="works-title">
        <div className="works-intro-copy">
          <p className="works-index mono">WORK WALL / 02</p>
          <h1 id="works-title">
            孩子们的想法，
            <br />
            <span>贴在这里。</span>
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
                <img src={work.cover} alt={`${work.title}项目封面`} loading="lazy" />
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
        </div>
      </section>

      <footer className="works-footer">
        <div className="works-footer-meta">
          <span>Alan张老师 · 少年 AI 创造营</span>
          <div className="site-filing" aria-label="网站备案信息">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
              苏ICP备2025178103号-2
            </a>
            <span aria-hidden="true">|</span>
            <a
              className="site-filing-police"
              href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32041202003961"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E"
                alt=""
              />
              <span>苏公网安备32041202003961号</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
