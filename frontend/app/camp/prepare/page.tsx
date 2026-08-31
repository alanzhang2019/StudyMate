import Link from 'next/link';

const ARROW_ICON = (
  <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
    <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
  </svg>
);

export default function PreparePage() {
  return (
    <div className="prepare-page">
      <header className="site-header" style={{ position: 'sticky', background: 'rgba(5,20,47,.9)' }}>
        <Link href="/camp" className="xgls-brand" aria-label="Alan张老师首页">
          <span className="brand-identity">
            <img className="brand-identity-mark" src="/assets/xgls-avatar.png" alt="" />
            <img className="brand-identity-wordmark" src="/assets/xgls-logo.svg" alt="Alan张老师" />
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

      <main className="prepare-content">
        <p className="section-kicker">PREPARE / 课前准备</p>
        <h1>
          开课前，
          <br />
          请先准备好这些。
        </h1>
        <p style={{ color: 'var(--paper-muted)', lineHeight: '1.7', maxWidth: '38rem', fontSize: '1rem' }}>
          为了保证孩子在第一节课就能顺利开始，请家长协助完成以下准备。每一步都很简单，但缺一不可。
        </p>

        <section>
          <h2>设备清单</h2>
          <ul className="prepare-checklist">
            <li>一台电脑（Windows / Mac 均可，不建议平板）</li>
            <li>稳定的网络连接（建议带宽 10Mbps 以上）</li>
            <li>摄像头与麦克风（用于课堂互动）</li>
            <li>Chrome 或 Edge 浏览器（最新版本）</li>
            <li>家长微信号（用于接收课堂记录）</li>
          </ul>
        </section>

        <section>
          <h2>三步完成课前准备</h2>
          <div className="prepare-steps">
            <article className="prepare-step">
              <span className="prepare-step-num mono">STEP 01</span>
              <h3>注册 Trae 账号</h3>
              <p>孩子将在课程中使用 Trae 这个 AI 编程工具。请提前注册一个免费账号，方便第一节课直接开始。</p>
              <a href="https://www.trae.cn" target="_blank" rel="noopener noreferrer">
                前往注册
                {ARROW_ICON}
              </a>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">STEP 02</span>
              <h3>聊聊孩子的想法</h3>
              <p>开课前，我们会和家长有一次 15 分钟的视频沟通，了解孩子想做什么项目，确认课程是否合适。</p>
              <Link href="/camp#consult">
                预约沟通
                {ARROW_ICON}
              </Link>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">STEP 03</span>
              <h3>测试设备环境</h3>
              <p>第一节课前 10 分钟，我们会一起测试摄像头、麦克风和网络，确保课堂顺利进行。</p>
              <Link href="/admin/login">
                登录测试
                {ARROW_ICON}
              </Link>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">STEP 04</span>
              <h3>准备好好奇心</h3>
              <p>这是最重要的一步。告诉孩子：你要做的不是作业，是一个真正属于自己的产品。想到什么都可以说。</p>
              <Link href="/camp/works">
                看看别人做了什么
                {ARROW_ICON}
              </Link>
            </article>
          </div>
        </section>

        <section>
          <h2>常见问题</h2>
          <div className="prepare-steps">
            <article className="prepare-step">
              <span className="prepare-step-num mono">Q1</span>
              <h3>孩子没有编程基础可以参加吗？</h3>
              <p>完全可以。创造营面向 7-12 岁零基础孩子，我们会从“怎么和 AI 说话”开始教起。</p>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">Q2</span>
              <h3>需要家长陪同上课吗？</h3>
              <p>前两节课建议家长陪同，之后孩子可以独立完成。每节课后我们会发送课堂记录给家长。</p>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">Q3</span>
              <h3>作品完成后会发布到哪里？</h3>
              <p>作品会发布在我们的作品墙，可以分享给亲友。每个作品都有独立的网址链接。</p>
            </article>
            <article className="prepare-step">
              <span className="prepare-step-num mono">Q4</span>
              <h3>如果错过课怎么办？</h3>
              <p>每节课都有录像回放，孩子可以随时补看。但建议尽量按时上课，互动效果更好。</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div
          style={{
            margin: '0 auto',
            paddingInline: 'var(--page-padding)',
            width: '100%',
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'end',
          }}
        >
          <div className="site-footer-meta">
            <p>Alan张老师 · 少年 AI 创造营</p>
            <p>让每个孩子都有属于自己的数字产品</p>
          </div>
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
          <p className="mono" style={{ justifySelf: 'end' }}>
            © 2025 XIAOGAO LAB
          </p>
        </div>
      </footer>
    </div>
  );
}
