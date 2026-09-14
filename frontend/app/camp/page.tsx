'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function CampPage() {
  const orbitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const journeyBarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const canvas = orbitCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    let t = 0;
    let raf = 0;
    const labels = ['想法', '定义', '设计', '建构', '修改', '发布'];

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let r = 60; r <= 300; r += 60) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 1.4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,242,233,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      labels.forEach((label, i) => {
        const angle = t * 0.0008 + i * ((Math.PI * 2) / labels.length);
        const r = 120 + i * 30;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * 1.4;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd447';
        ctx.fill();
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(245,242,233,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - 10);
      });
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd447';
      ctx.fill();
      t++;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const bar = journeyBarRef.current;
    if (!bar) return;

    const handler = () => {
      const el = document.querySelector('.journey-scroll');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height + vh)));
      bar.style.transform = `scale(${progress},1)`;
    };

    window.addEventListener('scroll', handler, { passive: true });
    handler();

    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/camp" className="alan-brand" aria-label="Alan张老师首页">
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
        <div className="header-actions">
          <Link href="/camp/works" className="page-switch-link">
            作品墙
          </Link>
          <Link href="/admin/login" className="site-login-link">
            教师登录
          </Link>
        </div>
      </header>

      <section className="hero hero-refined" aria-labelledby="hero-title">
        <div className="hero-visual">
          <canvas ref={orbitCanvasRef} aria-hidden="true" id="orbitCanvas" width="445" height="723" />
        </div>
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <span>AI 原生教育</span>
            <span>适合 7 岁+的大小朋友</span>
          </p>
          <h1 id="hero-title">
            <span className="hero-thought">有想法，</span>
            <span className="hero-action">去实现！</span>
          </h1>
          <p className="hero-intro">与 AI 完成一个属于自己的数字产品。</p>
          <div className="hero-actions">
            <Link href="/camp/works" className="button button-primary">
              看看作品
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
              </svg>
            </Link>
            <a className="button button-ghost" href="#courses">
              了解课程
            </a>
            <a className="hero-consult-link" href="#consult">
              微信咨询
            </a>
          </div>
        </div>
        <div className="hero-facts mono" aria-label="课程概要">
          <span>每天</span>
          <span>1 个项目</span>
          <span>1 次发布</span>
        </div>
      </section>

      <section id="featured-case" className="featured-case-section">
        <div className="section-shell">
          <header className="featured-case-heading">
            <h2 className="featured-case-h2-single">一个案例，看懂AI原生教育</h2>
            <p>我们将用一期的时间和孩子一起打磨他的产品。能力在这个过程中自然而然地发芽、生长。</p>
          </header>

          <div className="featured-case-overview">
            <div className="featured-case-log">
              <div className="featured-case-project-header">
                <div className="featured-case-project">
                  <span className="mono">互动游戏 / STUDENT PROJECT</span>
                  <h3 className="featured-case-h3-single">七岁炳炳的《动物迷宫大乱斗》</h3>
                  <p>一个项目不是一次就完成的。2 个阶段中，我们不断发现问题、调整规则、完善体验。</p>
                </div>
                <nav className="featured-case-outcomes" aria-label="查看炳炳的完整成果">
                  <Link href="/camp/work/animal-maze-battle" className="featured-case-outcome">
                    <span>作品页</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="17"
                      height="17"
                      fill="currentColor"
                    >
                      <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
                    </svg>
                  </Link>
                  <a
                    className="featured-case-outcome"
                    href="https://works.xgteacher.cn/work-0a64a48f2509/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>体验作品</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="17"
                      height="17"
                      fill="currentColor"
                    >
                      <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
                    </svg>
                  </a>
                </nav>
              </div>

              <ol className="work-log-track" aria-label="创作记录时间线">
                <li className="work-log-entry">
                  <article className="work-log-card">
                    <div className="work-log-time">
                      <time>第一阶段</time>
                      <span>· 想法定义</span>
                    </div>
                    <img
                      src="https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png"
                      alt="第1节课作品截图"
                    />
                    <strong>从"动物大乱斗"到迷宫</strong>
                    <span className="work-log-open">查看记录 →</span>
                  </article>
                </li>
                <li className="work-log-entry">
                  <article className="work-log-card">
                    <div className="work-log-time">
                      <time>第一阶段</time>
                      <span>· 规则调整</span>
                    </div>
                    <img
                      src="https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png"
                      alt="第1节课作品截图"
                    />
                    <strong>让小动物能吃能跑</strong>
                    <span className="work-log-open">查看记录 →</span>
                  </article>
                </li>
                <li className="work-log-entry">
                  <article className="work-log-card">
                    <div className="work-log-time">
                      <time>第二阶段</time>
                      <span>· 完善发布</span>
                    </div>
                    <img
                      src="https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png"
                      alt="第2节课作品截图"
                    />
                    <strong>终于可以分享了</strong>
                    <span className="work-log-open">查看记录 →</span>
                  </article>
                </li>
              </ol>
              <p className="work-log-hint">← 左右滑动查看 2 个阶段的完整记录</p>
            </div>
          </div>
        </div>
      </section>

      <section id="courses" className="course-overview">
        <div className="poster-course-grid">
          <article className="poster-course poster-course-camp">
            <figure className="poster-frame">
              <img src="/assets/alan-avatar.png" alt="创造营课程封面" />
            </figure>
            <div className="poster-course-copy">
              <h3 className="poster-course-h3-single">每天，做出一个真实产品</h3>
              <ul>
                <li>项目制学习，每个孩子一个独立项目</li>
                <li>从想法到上线，经历完整产品流程</li>
                <li>AI 辅助编程，7 岁也能做出真东西</li>
                <li>8 人小班，每天一次</li>
              </ul>
              <div className="course-price">
                <span>含课件、云服务、作品发布</span>
                <a href="#consult">咨询报名 →</a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="learning-section">
        <div className="section-shell">
          <header className="learning-heading">
            <p className="learning-method-label">METHOD / 我们怎么学</p>
            <h2>
              <span className="heading-phrase">不是学完再做，</span>
              <span className="heading-phrase">是在做中学。</span>
            </h2>
            <p>项目制学习（PBL）的核心是：孩子先有一个真实想做的项目，再在实现它的过程中学习需要的知识。</p>
          </header>

          <div className="pbl-overview">
            <div className="pbl-intro">
              <h3>PBL</h3>
              <p>项目制学习（Project-Based Learning）让孩子在真实项目中主动学习。不是“先学再做”，而是“在做中学”——遇到什么学什么，学完立刻用。</p>
              <div className="pbl-equation">
                <span>真实项目</span>
                <b>+</b>
                <span>AI 协作</span>
                <b>+</b>
                <span>教师引导</span>
                <strong>= 真实能力</strong>
              </div>
            </div>
            <div className="pbl-reasons">
              <article>
                <div className="pbl-reason-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <h3>真实问题驱动</h3>
                <p>每个项目都来自孩子自己的想法，不是模板题。有真实想解决的问题，学习才有动力。</p>
              </article>
              <article>
                <div className="pbl-reason-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3>过程重于结果</h3>
                <p>我们记录每一节课的调整与发现。重要的不是最后做出什么，而是过程中学会了什么。</p>
              </article>
              <article>
                <div className="pbl-reason-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <h3>AI 是协作者</h3>
                <p>孩子学会用 AI 写代码、查资料、想方案。AI 不是作弊，是让 7 岁也能做大事的新工具。</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="journey-scroll">
        <div className="section-shell">
          <header className="journey-heading">
            <div>
              <p className="section-kicker">JOURNEY / 学习旅程</p>
              <h2>一个项目，五个阶段</h2>
            </div>
            <p>从想法到发布，孩子会经历完整的创造旅程。</p>
          </header>
          <div className="journey-progress">
            <i ref={journeyBarRef} id="journeyBar" />
          </div>
          <ol className="journey-track">
            <li className="journey-panel">
              <span className="journey-panel-index mono">01</span>
              <div className="journey-panel-copy">
                <h3>定义</h3>
                <strong>把想法说清楚</strong>
                <p>孩子带着一个模糊的想法来，我们要把它变成可以执行的项目。</p>
              </div>
              <div className="journey-panel-visual">
                <svg className="journey-icon-orbit" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="40" cy="40" r="30" />
                  <circle cx="40" cy="40" r="15" />
                </svg>
              </div>
            </li>
            <li className="journey-panel">
              <span className="journey-panel-index mono">02</span>
              <div className="journey-panel-copy">
                <h3>设计</h3>
                <strong>想清楚怎么做</strong>
                <p>拆解功能、画原型、定规则。把大想法变成小步骤。</p>
              </div>
              <div className="journey-panel-visual">
                <svg className="journey-icon-orbit" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="15" y="15" width="50" height="50" />
                  <line x1="15" y1="35" x2="65" y2="35" />
                </svg>
              </div>
            </li>
            <li className="journey-panel">
              <span className="journey-panel-index mono">03</span>
              <div className="journey-panel-copy">
                <h3>建构</h3>
                <strong>动手做出来</strong>
                <p>用 AI 写代码、配素材、搭界面。这是最长也最有趣的阶段。</p>
              </div>
              <div className="journey-panel-visual">
                <svg className="journey-icon-orbit" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 60 L40 20 L60 60 Z" />
                </svg>
              </div>
            </li>
            <li className="journey-panel">
              <span className="journey-panel-index mono">04</span>
              <div className="journey-panel-copy">
                <h3>修改</h3>
                <strong>发现问题，调整</strong>
                <p>测试、试用、改 bug。真实产品就是要反复打磨。</p>
              </div>
              <div className="journey-panel-visual">
                <svg className="journey-icon-orbit" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 40 a20 20 0 1 1 40 0 a20 20 0 1 1 -40 0" />
                  <path d="M60 40 L65 35 M60 40 L55 35" />
                </svg>
              </div>
            </li>
            <li className="journey-panel">
              <span className="journey-panel-index mono">05</span>
              <div className="journey-panel-copy">
                <h3>发布</h3>
                <strong>让世界看到</strong>
                <p>作品上线，可以分享给朋友家人。这是属于孩子的真实数字产品。</p>
              </div>
              <div className="journey-panel-visual">
                <svg className="journey-icon-orbit" width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="40" cy="40" r="30" />
                  <path d="M40 20 L40 60 M20 40 L60 40" />
                </svg>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="ability-scroll">
        <div className="section-shell">
          <header className="ability-scroll-heading">
            <p className="section-kicker">ABILITY / 能力生长</p>
            <h2>不只是学会编程</h2>
            <p>创造营培养的是面向未来的综合能力。</p>
          </header>

          <div className="ability-stage">
            <div className="ability-radar">
              <svg className="ability-radar-chart" viewBox="0 0 200 200" role="img" aria-label="能力雷达图">
                <g className="ability-radar-grid">
                  <polygon points="100,20 175,65 145,155 55,155 25,65" />
                  <polygon points="100,44 152,75 131,138 69,138 48,75" />
                  <polygon points="100,68 129,85 117,121 83,121 71,85" />
                </g>
                <g className="ability-radar-axis">
                  <line x1="100" y1="100" x2="100" y2="20" />
                  <line x1="100" y1="100" x2="175" y2="65" />
                  <line x1="100" y1="100" x2="145" y2="155" />
                  <line x1="100" y1="100" x2="55" y2="155" />
                  <line x1="100" y1="100" x2="25" y2="65" />
                </g>
                <polygon className="ability-radar-active" points="100,35 165,68 135,145 62,148 35,72" />
                <g className="ability-radar-node">
                  <circle cx="100" cy="35" r="3" />
                  <circle cx="165" cy="68" r="3" />
                  <circle cx="135" cy="145" r="3" />
                  <circle cx="62" cy="148" r="3" />
                  <circle cx="35" cy="72" r="3" />
                </g>
                <circle className="ability-radar-origin" cx="100" cy="100" r="2" />
                <g className="ability-radar-label">
                  <text x="100" y="14">创造力</text>
                  <text x="182" y="65">逻辑</text>
                  <text x="150" y="170">表达</text>
                  <text x="50" y="170">协作</text>
                  <text x="18" y="65">审美</text>
                </g>
              </svg>
              <span className="ability-radar-scale ability-radar-scale-zero mono">0</span>
              <span className="ability-radar-scale ability-radar-scale-ten mono">10</span>
            </div>

            <div className="ability-details">
              <article className="ability-detail">
                <div className="ability-detail-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
                <h3>创造力</h3>
                <p>从无到有把自己的想法变成可以运行的产品。</p>
                <div>
                  <strong>评估方式</strong>
                  <span style={{ color: 'var(--paper-muted)', fontSize: '.88rem' }}>作品的原创性与完成度</span>
                </div>
              </article>
              <article className="ability-detail">
                <div className="ability-detail-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4z" />
                    <path d="M9 9h6v6H9z" />
                  </svg>
                </div>
                <h3>逻辑思维</h3>
                <p>拆解复杂问题，用步骤和条件组织程序。</p>
                <div>
                  <strong>评估方式</strong>
                  <span style={{ color: 'var(--paper-muted)', fontSize: '.88rem' }}>功能拆解的合理度</span>
                </div>
              </article>
              <article className="ability-detail">
                <div className="ability-detail-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3>表达能力</h3>
                <p>能讲清楚自己做了什么、为什么这么做。</p>
                <div>
                  <strong>评估方式</strong>
                  <span style={{ color: 'var(--paper-muted)', fontSize: '.88rem' }}>作品发布时的讲述</span>
                </div>
              </article>
              <article className="ability-detail">
                <div className="ability-detail-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3>协作能力</h3>
                <p>和同学、老师、AI 一起把事情做完，过程中表达与倾听。</p>
                <div>
                  <strong>评估方式</strong>
                  <span style={{ color: 'var(--paper-muted)', fontSize: '.88rem' }}>课程中的合作记录</span>
                </div>
              </article>
              <article className="ability-detail">
                <div className="ability-detail-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="13.5" cy="6.5" r=".5" />
                    <circle cx="17.5" cy="10.5" r=".5" />
                    <circle cx="8.5" cy="7.5" r=".5" />
                    <circle cx="6.5" cy="12.5" r=".5" />
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                  </svg>
                </div>
                <h3>审美与美感</h3>
                <p>在作品的颜色、节奏、动效上用心，让用户愿意多看一眼。</p>
                <div>
                  <strong>评估方式</strong>
                  <span style={{ color: 'var(--paper-muted)', fontSize: '.88rem' }}>作品的视觉与体验</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="trae-section">
        <div className="section-shell">
          <div className="tool-section">
            <div className="tool-mark">
              <div className="trae-brand">
                <span>Trae</span>
              </div>
              <span className="tool-plus" aria-hidden="true">+</span>
              <div className="workbuddy-brand">
                <span>WorkBuddy</span>
              </div>
              <div className="tool-pulse" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="tool-copy">
              <p className="section-kicker">TOOL / 我们用什么</p>
              <h2 className="tool-h2-single">和孩子一起用 Trae 和 WorkBuddy</h2>
              <p>Trae 是面向下一代开发者的 AI 原生 IDE，孩子可以用自然语言和 AI 一起写代码；WorkBuddy 是 Alan张老师的 AI 助手工作台，把课程、作品与一键部署串成一条线。两者配合，把想法变成可以运行、可以分享的产品。</p>
              <ul className="trae-abilities">
                <li>对话式编程</li>
                <li>实时预览</li>
                <li>一键部署</li>
                <li>多模态输入</li>
              </ul>
              <p className="tool-principle">
                <span>安全可控</span>
                <span>教师全程引导</span>
                <span>作品可离线运行</span>
              </p>
              <div className="tool-actions">
                <a className="tool-link" href="https://www.trae.cn" target="_blank" rel="noopener noreferrer">
                  了解 Trae →
                </a>
                <a className="tool-link" href="https://workbuddy.cn" target="_blank" rel="noopener noreferrer">
                  了解 WorkBuddy →
                </a>
                <a className="tool-link" href="#consult">
                  咨询课程 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section">
        <div className="section-shell about-grid">
          <div className="about-brand-identity">
            <img src="/assets/alan-avatar.png" alt="Alan张老师" />
            <img
              className="about-brand-wordmark"
              src="/assets/alan-logo.svg"
              alt="Alan张老师"
            />
          </div>
          <div className="about-copy">
            <p className="section-kicker">ABOUT / 关于</p>
            <h2>我是Alan张老师</h2>
            <p>我教孩子用 AI 做真实的产品。不是画画、不是搭积木，是真的能跑、能分享、能用的数字产品。</p>
            <p>过去 15 年，我在一线带过 2000+ 孩子做项目。我发现：当孩子有一个真实想做的事情，他们的学习能力和创造力会远超大人的想象。</p>
            <dl className="about-facts">
              <div>
                <dt>2000+</dt>
                <dd>学员作品</dd>
              </div>
              <div>
                <dt>15 年</dt>
                <dd>项目教学经验</dd>
              </div>
              <div>
                <dt>7 岁+</dt>
                <dd>适合年龄</dd>
              </div>
              <div>
                <dt>8 人</dt>
                <dd>小班上限</dd>
              </div>
            </dl>
            <div className="about-belief">
              <h3>
                <span>不要小看孩子，</span>
                <span>给他们真实的工具。</span>
              </h3>
              <p>7 岁的炳炳用 2 个阶段做出了《动物迷宫大乱斗》——有规则、有 AI、有交互。这不是玩具，是真正的产品。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="wechat-section" id="consult">
        <div className="section-shell wechat-grid">
          <div className="wechat-copy">
            <p className="section-kicker">CONSULT / 微信咨询</p>
            <h2>和孩子聊聊他的想法</h2>
            <p>每个孩子的项目都不一样。加我微信，我们先聊聊孩子想做什么，再决定合不合适。</p>
          </div>
          <div className="wechat-card">
            <img
              src="/assets/alan-wechat-qr.jpg"
              alt="Alan张老师微信二维码"
              style={{ width: '180px', height: '180px', borderRadius: '8px' }}
            />
            <strong>扫码加微信</strong>
            <span>备注「AI 原生教育」</span>
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
            <p>让每个孩子都有属于自己的数字产品</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
