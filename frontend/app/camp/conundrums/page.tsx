'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CONUNDRA,
  CONUNDRUM_CATEGORIES,
  LOCAL_VIDEO_IDS,
  type ConundrumCategory,
} from '../../../lib/camp/conundrums';

type Filter = '全部' | ConundrumCategory;

export default function ConundrumsPage() {
  const [filter, setFilter] = useState<Filter>('全部');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  // 浏览器自动播放策略拒绝「有声起播」时，我们会降级为静音播放。
  // 此时提示用户「点一下开声音」，避免出现"播了但没声音"的困惑。
  const [mutedByPolicy, setMutedByPolicy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 点开「看视频」后自动起播。
  // 单写 autoPlay 属性是不够的：实测 Chromium 默认策略会直接拒绝有声自动播放
  // （视频停在 0:00 不动，正是这个原因）。所以这里手动兜底：
  //  1) 先尝试带声播放；
  //  2) 被拒则改为静音播放（浏览器一定允许）—— 并标记 mutedByPolicy，
  //     渲染一个「开声音」按钮，把控制权交还用户；
  //  3) 都失败就保留原生 controls，交给用户点，不阻塞、不报错。
  useEffect(() => {
    if (!playingKey) return;
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;
    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        if (cancelled) return;
        el.muted = true;
        try {
          await el.play();
          if (!cancelled) setMutedByPolicy(true);
        } catch {
          /* 浏览器彻底拒绝自动播放：保留原生 controls，交给用户点 */
        }
      }
    };
    void tryPlay();
    return () => {
      cancelled = true;
    };
  }, [playingKey]);

  // 用户点「收起播放」时清掉静音提示，下次点开重新走一遍自动播放判定。
  const closePlayer = () => {
    setPlayingKey(null);
    setMutedByPolicy(false);
  };

  // 解除静音（用户主动点击 = 有交互手势，浏览器会放行有声播放）。
  const unmute = () => {
    const el = videoRef.current;
    if (el) el.muted = false;
    setMutedByPolicy(false);
  };

  const filters: Filter[] = ['全部', ...CONUNDRUM_CATEGORIES];
  const list =
    filter === '全部'
      ? CONUNDRA
      : CONUNDRA.filter((c) => c.category === filter);

  // 课题数、主题数一律从数据推导，避免增删课题后文案里的数字对不上。
  const total = CONUNDRA.length;
  const topicCount = CONUNDRUM_CATEGORIES.length;

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
              这里收集了马斯克星球学校的 {total} 个真实世界难题——没人能替你拍板的那种。我们用 AI 把它们变成你能动手做的项目：想清楚、做出来、发出去。
            </p>
            <div className="hero-facts mono" aria-label="课题概要">
              <span>{total} 个难题</span>
              <span>{topicCount} 大主题</span>
              <span>0 个标准答案</span>
            </div>
          </div>
          <figure className="conundrum-hero-figure">
            <img
              src="/assets/musk-conundrum-hero.png"
              alt="马斯克让孩子坐在肩上"
              loading="lazy"
            />
            <figcaption className="conundrum-hero-caption mono">
              <span className="conundrum-hero-caption-name">
                埃隆·马斯克
              </span>
              <span className="conundrum-hero-caption-role">
                Astra Nova 星球学校创办人
              </span>
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
              const hasLocalVideo = LOCAL_VIDEO_IDS.includes(c.id);
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
                        {hasLocalVideo ? (
                          <div className="conundrum-videos">
                            {playingKey === c.id ? (
                              <div className="conundrum-player">
                                {/* 自动起播：由上面的 useEffect 通过 ref 统一驱动
                                    （先尝试有声，被浏览器拒绝则降级静音），
                                    比只写 autoPlay 属性可靠。
                                    key 保证切换课题时重建 video，不复用旧 src。
                                    preload 保持 metadata：play() 本身就会触发加载，
                                    不必在挂载阶段就抢带宽（单集平均 4.5MB）。 */}
                                <video
                                  key={c.id}
                                  ref={videoRef}
                                  src={`/videos/conundrums/${c.id}.mp4`}
                                  controls
                                  playsInline
                                  preload="metadata"
                                />
                                {mutedByPolicy ? (
                                  <button
                                    type="button"
                                    className="conundrum-player-unmute"
                                    onClick={unmute}
                                  >
                                    🔇 正在静音播放 —— 点这里开声音
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="conundrum-player-back"
                                  onClick={closePlayer}
                                >
                                  ← 收起播放
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="conundrum-video-item"
                                onClick={() => setPlayingKey(c.id)}
                              >
                                <span className="conundrum-video-play" aria-hidden="true">▶</span>
                                <span>{c.bilibiliVideos?.[0]?.title ?? c.title}</span>
                                <span className="conundrum-video-mono mono">本片已收录</span>
                              </button>
                            )}
                          </div>
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
