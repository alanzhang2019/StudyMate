'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CONUNDRA,
  CONUNDRUM_CATEGORIES,
  type ConundrumCategory,
} from '../../../lib/camp/conundrums';

type Filter = '全部' | ConundrumCategory;

export default function ConundrumsPage() {
  const [filter, setFilter] = useState<Filter>('全部');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const filters: Filter[] = ['全部', ...CONUNDRUM_CATEGORIES];
  const list =
    filter === '全部'
      ? CONUNDRA
      : CONUNDRA.filter((c) => c.category === filter);

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/camp" className="alan-brand" aria-label="Alan张老师首页">
          <span className="brand-identity">
            <img className="brand-identity-mark" src="/assets/alan-avatar.png" alt="" />
            <img className="brand-identity-wordmark" src="/assets/alan-logo.svg" alt="Alan张老师" />
          </span>
        </Link>
        <div className="header-actions">
          <Link href="/camp" className="page-switch-link">
            首页
          </Link>
          <Link href="/camp/works" className="page-switch-link">
            作品墙
          </Link>
          <Link href="/admin/login" className="site-login-link">
            教师登录
          </Link>
        </div>
      </header>

      <section className="conundrum-hero">
        <div className="section-shell conundrum-hero-grid">
          <div className="conundrum-hero-copy">
            <p className="section-kicker">REAL-WORLD PROBLEMS / 真实世界的问题</p>
            <h1>
              <span className="hero-thought">没有标准答案，</span>
              <span className="hero-action">才是真实的问题</span>
            </h1>
            <p className="conundrum-hero-intro">
              这里收集了马斯克星球学校的 28 个真实世界难题——没人能替你拍板的那种。我们用 AI 把它们变成你能动手做的项目：想清楚、做出来、发出去。
            </p>
            <div className="hero-facts mono" aria-label="课题概要">
              <span>28 个难题</span>
              <span>6 大主题</span>
              <span>0 个标准答案</span>
            </div>
          </div>
          <figure className="conundrum-hero-figure">
            <img
              src="/assets/musk-conundrum-hero.png"
              alt="马斯克让孩子坐在肩上"
              loading="lazy"
            />
            <figcaption className="mono">
              Astra Nova 学校创办人 · 这些难题来自他办的学校
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="conundrum-list">
        <div className="section-shell">
          <div className="conundrum-filters" role="tablist" aria-label="按主题筛选">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                className={`conundrum-filter${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="conundrum-grid">
            {list.map((c) => {
              const open = expanded === c.id;
              return (
                <article key={c.id} className={`conundrum-card${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="conundrum-card-head"
                    onClick={() => setExpanded(open ? null : c.id)}
                    aria-expanded={open}
                  >
                    <span className="conundrum-card-cat">{c.category}</span>
                    <h3>{c.title}</h3>
                    <p className="conundrum-card-q">{c.question}</p>
                    <span className="conundrum-card-toggle">
                      {open ? '收起' : '展开怎么做 →'}
                    </span>
                  </button>
                  {open && (
                    <div className="conundrum-card-body">
                      <div className="conundrum-block">
                        <span className="conundrum-block-label">情境</span>
                        <p>{c.situation}</p>
                      </div>
                      <div className="conundrum-block">
                        <span className="conundrum-block-label">核心难题</span>
                        <p>{c.question}</p>
                      </div>
                      <div className="conundrum-block">
                        <span className="conundrum-block-label">讨论引导</span>
                        <ul>
                          {c.discussion.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="conundrum-block conundrum-block-project">
                        <span className="conundrum-block-label">变成 AI 项目</span>
                        <p>{c.aiProject}</p>
                        <p className="conundrum-block-hint">
                          走创造营五阶段：定义 → 设计 → 建构 → 修改 → 发布
                        </p>
                      </div>
                      <div className="conundrum-block">
                        <span className="conundrum-block-label">看视频</span>
                        {c.bilibiliVideos && c.bilibiliVideos.length > 0 ? (
                          <ul className="conundrum-videos">
                            {c.bilibiliVideos.map((v) => {
                              const playKey = `${c.id}:${v.bvid}`;
                              const isPlaying = playingKey === playKey;
                              return (
                                <li key={v.bvid} className={isPlaying ? 'is-playing' : ''}>
                                  {isPlaying ? (
                                    <div className="conundrum-player">
                                      <iframe
                                        src={`https://player.bilibili.com/player.html?bvid=${v.bvid}&high_quality=1&danmaku=0&autoplay=1`}
                                        title={v.title}
                                        scrolling="no"
                                        frameBorder="0"
                                        allowFullScreen
                                        referrerPolicy="no-referrer"
                                      />
                                      <button
                                        type="button"
                                        className="conundrum-player-back"
                                        onClick={() => setPlayingKey(null)}
                                      >
                                        ← 收起播放
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="conundrum-video-item"
                                      onClick={() => setPlayingKey(playKey)}
                                    >
                                      <span className="conundrum-video-play" aria-hidden="true">▶</span>
                                      <span>{v.title}</span>
                                      <span className="conundrum-video-mono mono">{v.bvid}</span>
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : c.officialVideo ? (
                          <div className="conundrum-official">
                            <p className="conundrum-video-empty">
                              国内平台暂时没有中文搬运，直接看官网原片：
                            </p>
                            <a
                              className="conundrum-official-link"
                              href={c.officialVideo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="conundrum-video-play" aria-hidden="true">▶</span>
                              <span>{c.officialVideo.title}</span>
                              <span className="conundrum-video-mono mono">{c.officialVideo.source}</span>
                            </a>
                          </div>
                        ) : (
                          <p className="conundrum-video-empty">
                            这个课题暂时还没有中文视频，可以先去 B 站找找看。
                          </p>
                        )}
                        <a
                          className="conundrum-video-search"
                          href={c.bilibiliSearch}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          在 B 站搜索相关视频 →
                        </a>
                      </div>
                      <Link href="/camp/works" className="button button-primary conundrum-card-cta">
                        看看做成了什么
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div
          className="section-shell"
          style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr', alignItems: 'end', width: '100%' }}
        >
          <div className="site-footer-meta">
            <p>Alan张老师 · AI 原生教育</p>
            <p>让每个孩子都能解决真实世界的问题</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
