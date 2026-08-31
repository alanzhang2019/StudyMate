'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

type Lesson = {
  time: string;
  tag: string;
  image: string;
  title: string;
  description: string;
};

type WorkDetail = {
  slug: string;
  title: string;
  category: string;
  date: string;
  studentLabel: string;
  views: number;
  cover: string;
  externalUrl: string;
  intro: string;
  figcaption: string;
  processIntro: string;
  lessons: Lesson[];
  abilityHeading: string;
  abilityIntro: string;
  abilityNote: string;
  radarShape: string;
  radarNodes: [number, number][];
  radarScores: number[];
  shareTitle: string;
  shareText: string;
};

const ANIMAL_COVER =
  'https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png';
const FORMATION_COVER =
  'https://works.xgteacher.cn/media/covers/57b7dea2-a05e-4f67-9ed9-19b47bc0bda5/0df250aa-775f-416f-ba77-820aa326fa56.png';

const WORKS: Record<string, WorkDetail> = {
  'animal-maze-battle': {
    slug: 'animal-maze-battle',
    title: '动物迷宫大乱斗',
    category: '互动游戏',
    date: '08/18',
    studentLabel: '炳炳 · 7 岁',
    views: 92,
    cover: ANIMAL_COVER,
    externalUrl: 'https://works.xgteacher.cn/work-0a64a48f2509/',
    intro:
      '这是一个动物大乱斗的世界，我们要在这个世界里寻找自己的目标，通过吞噬小卡拉米，让自己强大起来！',
    figcaption: '炳炳 · 第 10 节课完成版本 · 2025/08/18',
    processIntro: '10 节课，从想法到上线。每节课都有新的发现和调整。',
    lessons: [
      {
        time: '第 1 节',
        tag: '想法定义',
        image: ANIMAL_COVER,
        title: '从“动物大乱斗”到迷宫',
        description: '炳炳说想做一个动物互相吃的游戏。我们一起把它变成了“迷宫里的动物大乱斗”。',
      },
      {
        time: '第 3 节',
        tag: '素材准备',
        image: ANIMAL_COVER,
        title: '画动物，定角色',
        description: '用 AI 生成动物图片，选定主角和被吃的小动物。',
      },
      {
        time: '第 5 节',
        tag: '规则调整',
        image: ANIMAL_COVER,
        title: '让小动物能吃能跑',
        description: '动物要会移动、会吃、会变大。我们一起写了移动和碰撞的逻辑。',
      },
      {
        time: '第 7 节',
        tag: '体验优化',
        image: ANIMAL_COVER,
        title: '加一个胜利条件',
        description: '光吃没意思，要有目标。炳炳决定：吃满 10 个就算赢。',
      },
      {
        time: '第 10 节',
        tag: '完善发布',
        image: ANIMAL_COVER,
        title: '终于可以分享了',
        description: '修完最后的 bug，作品上线。炳炳把它发给了好朋友。',
      },
    ],
    abilityHeading: '炳炳学到了什么',
    abilityIntro: '不只是做完了游戏，更是在过程中长出了这些能力。',
    abilityNote: '* 评估基于 10 节课的过程记录，非标准化测试。',
    radarShape: '220,55 375,128 320,265 115,270 65,130',
    radarNodes: [
      [220, 55],
      [375, 128],
      [320, 265],
      [115, 270],
      [65, 130],
    ],
    radarScores: [9, 8, 7, 8, 7],
    shareTitle: '动物迷宫大乱斗',
    shareText: '7 岁炳炳用 AI 做的游戏',
  },
  'formation-editor': {
    slug: 'formation-editor',
    title: 'Formation 队形编辑器',
    category: '生活工具',
    date: '07/30',
    studentLabel: '小高 · 6 岁',
    views: 228,
    cover: FORMATION_COVER,
    externalUrl: 'https://works.xgteacher.cn/work-57b7dea2a05e/',
    intro: '我们可以用它来编排生活中的队形——从升旗仪式到运动会方阵，拖拽即生成，简单又直观。',
    figcaption: '小高 · 第 8 节课完成版本 · 2025/07/30',
    processIntro: '8 节课，把一个生活中的小问题变成了可以用的工具。',
    lessons: [
      {
        time: '第 1 节',
        tag: '问题发现',
        image: FORMATION_COVER,
        title: '排队太麻烦了',
        description: '老师每次排队形都要画图，不如做个工具来拖拽生成。',
      },
      {
        time: '第 3 节',
        tag: '界面搭建',
        image: FORMATION_COVER,
        title: '画一块场地',
        description: '先做出一个可以放人的画布，再慢慢加功能。',
      },
      {
        time: '第 5 节',
        tag: '拖拽功能',
        image: FORMATION_COVER,
        title: '让人能动起来',
        description: '让代表人的圆点可以拖拽，还要记录位置。',
      },
      {
        time: '第 8 节',
        tag: '完善发布',
        image: FORMATION_COVER,
        title: '能保存能分享',
        description: '加了保存和导出图片功能，作品上线。',
      },
    ],
    abilityHeading: '小高学到了什么',
    abilityIntro: '从一个生活痛点出发，完成了一个能真正用的工具。',
    abilityNote: '* 评估基于 8 节课的过程记录，非标准化测试。',
    radarShape: '220,50 380,125 325,270 108,275 58,128',
    radarNodes: [
      [220, 50],
      [380, 125],
      [325, 270],
      [108, 275],
      [58, 128],
    ],
    radarScores: [9, 9, 8, 7, 8],
    shareTitle: 'Formation 队形编辑器',
    shareText: '6 岁小高用 AI 做的工具',
  },
};

const RADAR_LABELS = [
  { label: '创造力', x: 220, y: 30 },
  { label: '逻辑', x: 405, y: 118 },
  { label: '表达', x: 345, y: 305 },
  { label: '协作', x: 95, y: 305 },
  { label: '审美', x: 35, y: 118 },
];

export default function WorkDetailPage() {
  const params = useParams<{ slug: string }>();
  const work = WORKS[params.slug];

  if (!work) {
    return (
      <div className="work-detail-page">
        <div className="work-detail-hero">
          <div className="work-detail-heading">
            <Link href="/camp/works" className="work-back">
              返回作品墙
            </Link>
            <h1>作品不存在</h1>
          </div>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    const shareData = {
      title: work.shareTitle,
      text: work.shareText,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('链接已复制，可以粘贴给朋友。');
      }
    } catch {
      /* 用户取消分享等场景，静默处理 */
    }
  };

  return (
    <div className="work-detail-page">
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
        <nav className="works-header-actions" aria-label="作品详情导航">
          <Link href="/camp/works" className="page-switch-link">
            作品墙
          </Link>
          <Link href="/admin/login" className="site-login-link">
            教师登录
          </Link>
        </nav>
      </header>

      <section className="work-detail-hero">
        <div className="work-detail-heading">
          <Link href="/camp/works" className="work-back">
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
              <path
                d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"
                transform="rotate(180 128 128)"
              />
            </svg>
            返回作品墙
          </Link>
          <p className="mono">
            {work.category} / STUDENT PROJECT · {work.date}
          </p>
          <h1>{work.title}</h1>
          <p>{work.intro}</p>
          <div className="work-detail-meta">
            <span>
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z" />
              </svg>
              {work.category}
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M172,36a52,52,0,0,0-38.84,86.76A52,52,0,1,0,122.84,122.76,52,52,0,1,0,172,36ZM76,84a28,28,0,1,1-28,28A28,28,0,0,1,76,84Zm32.17,61A52.12,52.12,0,0,0,124,156v52H36a36,36,0,0,1,36-36,51.69,51.69,0,0,0,24.17-7ZM184,208a36,36,0,0,1-36,36H60v-88a36,36,0,0,1,36,36,52,52,0,0,0,40,50.83V208Zm28-92a28,28,0,1,1,28-28A28,28,0,0,1,212,116Z" />
              </svg>
              {work.studentLabel}
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M251,123.13c-.37-.81-9.13-20.26-28.48-39.61C196.63,57.67,164,44,128,44S59.37,57.67,33.51,83.52C14.16,102.87,5.4,122.32,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212s68.63-13.66,94.48-39.51c19.36-19.35,28.12-38.79,28.49-39.61A12.08,12.08,0,0,0,251,123.13Zm-46.06,33C183.47,177.27,157.59,188,128,188s-55.47-10.73-76.91-31.88A130.36,130.36,0,0,1,29.52,128,130.45,130.45,0,0,1,51.09,99.89C72.54,78.73,98.41,68,128,68s55.46,10.73,76.91,31.89A130.36,130.36,0,0,1,226.48,128,130.45,130.45,0,0,1,204.91,156.12ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Z" />
              </svg>
              {work.views} 次浏览
            </span>
          </div>
          <div className="work-detail-actions">
            <a
              className="work-detail-action-primary"
              href={work.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              体验作品
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
              </svg>
            </a>
            <button className="work-detail-action-secondary" type="button" onClick={handleShare}>
              分享作品
            </button>
          </div>
        </div>

        <figure className="work-detail-cover">
          <img src={work.cover} alt={`${work.title}项目封面`} />
          <figcaption>{work.figcaption}</figcaption>
        </figure>
      </section>

      <section className="work-process-log">
        <header className="work-process-heading">
          <h2>创作记录</h2>
          <p>{work.processIntro}</p>
        </header>
        <div className="work-log-list">
          <ol className="work-log-track">
            {work.lessons.map((lesson) => (
              <li className="work-log-entry" key={`${lesson.time}-${lesson.tag}`}>
                <article className="work-log-card">
                  <div className="work-log-time">
                    <time>{lesson.time}</time>
                    <span>· {lesson.tag}</span>
                  </div>
                  <img src={lesson.image} alt={`${lesson.time}作品截图`} />
                  <strong>{lesson.title}</strong>
                  <p>{lesson.description}</p>
                  <span className="work-log-open">
                    查看记录
                    <svg viewBox="0 0 256 256" fill="currentColor">
                      <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
                    </svg>
                  </span>
                </article>
              </li>
            ))}
          </ol>
          <p className="work-log-hint">← 左右滑动查看 {work.lessons.length} 节课的完整记录</p>
        </div>
      </section>

      <section className="work-ability-profile">
        <div className="work-ability-heading">
          <p className="section-kicker">ABILITY / 能力评估</p>
          <h2>{work.abilityHeading}</h2>
          <p>{work.abilityIntro}</p>
          <p className="work-ability-note">{work.abilityNote}</p>
        </div>
        <div className="work-ability-chart">
          <div className="work-ability-radar">
            <svg viewBox="0 0 440 320" role="img" aria-label={`${work.abilityHeading}能力雷达图`}>
              <g className="work-ability-radar-grid">
                <polygon points="220,40 390,120 340,280 100,280 50,120" />
                <polygon points="220,80 350,136 315,240 125,240 90,136" />
                <polygon points="220,120 310,152 290,200 150,200 130,152" />
                <line x1="220" y1="160" x2="220" y2="40" />
                <line x1="220" y1="160" x2="390" y2="120" />
                <line x1="220" y1="160" x2="340" y2="280" />
                <line x1="220" y1="160" x2="100" y2="280" />
                <line x1="220" y1="160" x2="50" y2="120" />
              </g>
              <polygon className="work-ability-radar-shape" points={work.radarShape} />
              <g className="work-ability-radar-node">
                {work.radarNodes.map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
                ))}
              </g>
              <g className="work-ability-radar-label">
                {RADAR_LABELS.map((label, i) => (
                  <text key={label.label} x={label.x} y={label.y} textAnchor="middle">
                    {label.label}
                    <tspan x={label.x} dy="14">
                      {work.radarScores[i]}
                    </tspan>
                  </text>
                ))}
              </g>
            </svg>
          </div>
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
