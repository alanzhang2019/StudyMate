'use client';

import { useEffect, useState } from 'react';
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
  hasHtml: boolean;
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
  teacherComment: string;
  shareTitle: string;
  shareText: string;
  video: string;
};

const ANIMAL_COVER =
  'https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png';
const FORMATION_COVER =
  'https://works.xgteacher.cn/media/covers/57b7dea2-a05e-4f67-9ed9-19b47bc0bda5/0df250aa-775f-416f-ba77-820aa326fa56.png';

// 两个早期示范作品（炳炳 / 小高）为静态种子，含完整创作记录与能力雷达。
const SEED_WORKS: Record<string, WorkDetail> = {
  'animal-maze-battle': {
    slug: 'animal-maze-battle',
    title: '动物迷宫大乱斗',
    category: '互动游戏',
    date: '08/18',
    studentLabel: '炳炳 · 7 岁',
    views: 92,
    cover: ANIMAL_COVER,
    externalUrl: 'https://works.xgteacher.cn/work-0a64a48f2509/',
    hasHtml: false,
    intro:
      '这是一个动物大乱斗的世界，我们要在这个世界里寻找自己的目标，通过吞噬小卡拉米，让自己强大起来！',
    figcaption: '炳炳 · 第二阶段完成版本 · 2025/08/18',
    processIntro: '2 个阶段，从想法到上线。每个阶段都有新的发现和调整。',
    lessons: [
      {
        time: '第一阶段',
        tag: '想法定义',
        image: ANIMAL_COVER,
        title: '从“动物大乱斗”到迷宫',
        description: '炳炳说想做一个动物互相吃的游戏。我们一起把它变成了“迷宫里的动物大乱斗”。',
      },
      {
        time: '第一阶段',
        tag: '素材准备',
        image: ANIMAL_COVER,
        title: '画动物，定角色',
        description: '用 AI 生成动物图片，选定主角和被吃的小动物。',
      },
      {
        time: '第一阶段',
        tag: '规则调整',
        image: ANIMAL_COVER,
        title: '让小动物能吃能跑',
        description: '动物要会移动、会吃、会变大。我们一起写了移动和碰撞的逻辑。',
      },
      {
        time: '第二阶段',
        tag: '体验优化',
        image: ANIMAL_COVER,
        title: '加一个胜利条件',
        description: '光吃没意思，要有目标。炳炳决定：吃满 10 个就算赢。',
      },
      {
        time: '第二阶段',
        tag: '完善发布',
        image: ANIMAL_COVER,
        title: '终于可以分享了',
        description: '修完最后的 bug，作品上线。炳炳把它发给了好朋友。',
      },
    ],
    abilityHeading: '炳炳学到了什么',
    abilityIntro: '不只是做完了游戏，更是在过程中长出了这些能力。',
    abilityNote: '* 评估基于 2 个阶段的过程记录，非标准化测试。',
    radarShape: '220,55 375,128 320,265 115,270 65,130',
    radarNodes: [
      [220, 55],
      [375, 128],
      [320, 265],
      [115, 270],
      [65, 130],
    ],
    radarScores: [9, 8, 7, 8, 7],
    teacherComment:
      '炳炳对「游戏规则」有天然的敏感——从动物乱斗到迷宫寻路，是他自己想清楚了什么好玩、什么公平。最打动我的是他不怕改：规则不对就推翻重来，这比任何技巧都珍贵。',
    shareTitle: '动物迷宫大乱斗',
    shareText: '7 岁炳炳用 AI 做的游戏',
    video: '',
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
    hasHtml: false,
    intro: '我们可以用它来编排生活中的队形——从升旗仪式到运动会方阵，拖拽即生成，简单又直观。',
    figcaption: '小高 · 第八阶段完成版本 · 2025/07/30',
    processIntro: '8 个阶段，把一个生活中的小问题变成了可以用的工具。',
    lessons: [
      {
        time: '第一阶段',
        tag: '问题发现',
        image: FORMATION_COVER,
        title: '排队太麻烦了',
        description: '老师每次排队形都要画图，不如做个工具来拖拽生成。',
      },
      {
        time: '第三阶段',
        tag: '界面搭建',
        image: FORMATION_COVER,
        title: '画一块场地',
        description: '先做出一个可以放人的画布，再慢慢加功能。',
      },
      {
        time: '第五阶段',
        tag: '拖拽功能',
        image: FORMATION_COVER,
        title: '让人能动起来',
        description: '让代表人的圆点可以拖拽，还要记录位置。',
      },
      {
        time: '第八阶段',
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
    teacherComment:
      '小高是典型的「问题发现者」——排队形这件小事，他盯住了就不放。从画场地到拖拽、保存、导出，每一步都在解决一个真实需求。工具感很强，是我很欣赏的产品直觉。',
    shareTitle: 'Formation 队形编辑器',
    shareText: '6 岁小高用 AI 做的工具',
    video: '',
  },
};

const RADAR_LABELS = [
  { label: '创造力', x: 220, y: 30 },
  { label: '逻辑', x: 405, y: 118 },
  { label: '表达', x: 345, y: 305 },
  { label: '协作', x: 95, y: 305 },
  { label: '审美', x: 35, y: 118 },
];

// 雷达图几何：viewBox 0 0 440 320，中心 (220,160)。
// 五个满分顶点（score=10）与网格外层 polygon 一致。
const RADAR_CENTER = { x: 220, y: 160 };
const RADAR_VERTICES = [
  { x: 220, y: 40 }, // 创造力（顶）
  { x: 390, y: 120 }, // 逻辑（右上）
  { x: 340, y: 280 }, // 表达（右下）
  { x: 100, y: 280 }, // 协作（左下）
  { x: 50, y: 120 }, // 审美（左上）
];

// 把 5 个 0-10 的分数线性插值成雷达图节点坐标。
// score=10 落在顶点，score=0 收拢到中心。
function computeRadarFromScores(scores: number[]): {
  shape: string;
  nodes: [number, number][];
} {
  const nodes: [number, number][] = RADAR_VERTICES.map((v, i) => {
    const s = Math.max(0, Math.min(10, Number(scores[i]) || 0)) / 10;
    const x = RADAR_CENTER.x + (v.x - RADAR_CENTER.x) * s;
    const y = RADAR_CENTER.y + (v.y - RADAR_CENTER.y) * s;
    return [Math.round(x), Math.round(y)];
  });
  return {
    shape: nodes.map(([x, y]) => `${x},${y}`).join(' '),
    nodes,
  };
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

// 客户端按需生成二维码（qrcode 纯 JS，动态 import 避免首屏开销）。
function ShareQr({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(value, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#16294a', light: '#ffffff' },
        });
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        console.error('[share-qr] generate failed:', e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return <p className="share-qr-fallback">二维码生成失败，请改用「复制链接」分享。</p>;
  }
  if (!dataUrl) {
    return <div className="share-qr-loading">二维码生成中…</div>;
  }
  return <img className="share-qr" src={dataUrl} alt="作品二维码，微信扫一扫打开" />;
}

function ShareModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-tape" aria-hidden="true" />
        <button className="share-modal-close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2 className="share-modal-title">扫码分享作品</h2>
        <div className="share-qr-card">
          <ShareQr value={url} />
        </div>
        <p className="share-modal-hint">微信扫一扫，打开「{title}」</p>
        <p className="share-modal-sub">
          打开后点右上角 <strong>···</strong>，即可发送给朋友 / 分享到朋友圈
        </p>
        <div className="share-modal-actions">
          <button className="share-copy-btn" type="button" onClick={copy}>
            {copied ? '已复制 ✓' : '复制链接'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 把后台库里的作品行映射成详情页可用的结构。
// 库里现在存了完整的富内容（创作记录 / 能力评估 / 老师点评），
// 结构化后直接渲染，与早期种子作品的展示保持同一套 UI。
function mapDbWorkToDetail(row: any): WorkDetail {
  const studentLabel = [row.studentName, row.grade]
    .filter(Boolean)
    .join(' · ');

  // 创作记录：processLog 数组 → lessons
  const processLog = Array.isArray(row.processLog) ? row.processLog : [];
  const lessons: Lesson[] = processLog
    .filter((it: any) => it && typeof it === 'object')
    .map((it: any) => ({
      time: typeof it.time === 'string' ? it.time : '',
      tag: typeof it.tag === 'string' ? it.tag : '',
      image:
        typeof it.image === 'string' && it.image.trim()
          ? it.image
          : row.coverImage || '',
      title: typeof it.title === 'string' ? it.title : '',
      description: typeof it.description === 'string' ? it.description : '',
    }));

  // 能力评估：ability 对象 → radar 几何
  const ability = row.ability && typeof row.ability === 'object' ? row.ability : null;
  const scores = ability && Array.isArray(ability.scores) ? ability.scores : [];
  const hasRadar = scores.length === 5;
  const radar = hasRadar ? computeRadarFromScores(scores) : { shape: '', nodes: [] as [number, number][] };

  return {
    slug: row.id,
    title: row.title || '未命名作品',
    category: row.category || '作品',
    date: formatDate(row.createdAt),
    studentLabel: studentLabel || '匿名学员',
    views: typeof row.viewCount === 'number' ? row.viewCount : 0,
    cover: row.coverImage || '',
    externalUrl: row.linkUrl || '',
    hasHtml: !!row.htmlFile,
    intro: row.description || '',
    figcaption: studentLabel || '',
    processIntro:
      lessons.length > 0
        ? `${lessons.length} 个阶段，从想法到上线。每一段都有新的发现和调整。`
        : '',
    lessons,
    abilityHeading: hasRadar
      ? (ability.heading || `${studentLabel || '学员'}学到了什么`)
      : '',
    abilityIntro: hasRadar
      ? (ability.intro || '不只是完成了作品，更是在过程中长出了这些能力。')
      : '',
    abilityNote: hasRadar
      ? (ability.note || '* 评估基于课堂过程记录，非标准化测试。')
      : '',
    radarShape: radar.shape,
    radarNodes: radar.nodes,
    radarScores: hasRadar ? scores : [],
    teacherComment: row.teacherComment || '',
    // 介绍视频：优先用后台上传的本地文件（/api/camp/videos/...），
    // 其次用外部直链（仅允许 http(s)，避免注入非法协议）。
    video:
      row.introVideoFile ||
      (/^https?:\/\//i.test(row.introVideoUrl || '') ? row.introVideoUrl : '') ||
      '',
    shareTitle: row.title || '学员作品',
    shareText: `${studentLabel || '学员'} 的作品`,
  };
}

export default function WorkDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [work, setWork] = useState<WorkDetail | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 种子作品（静态）优先，命中即直接展示完整内容。
    if (slug && SEED_WORKS[slug]) {
      setWork(SEED_WORKS[slug]);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/camp/works/${slug}`);
        if (res.status === 404) {
          if (!cancelled) setWork(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '获取失败');
        if (cancelled) return;
        setWork(mapDbWorkToDetail(json.data));
        // 浏览计数：不 await，失败也不影响阅读。
        // 服务端有 6 小时去重窗口 + 每 IP 每分钟节流，重复刷新不会灌水。
        void fetch(`/api/camp/works/${json.data.id}/view`, { method: 'POST' }).catch(
          () => {},
        );
      } catch (e) {
        console.error('[camp/work/:slug] load error:', e);
        if (!cancelled) setWork(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="work-detail-page">
        <div className="work-detail-hero">
          <div className="work-detail-heading">
            <Link href="/camp/works" className="work-back">
              返回作品墙
            </Link>
            <h1>加载中…</h1>
          </div>
        </div>
      </div>
    );
  }

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

  const hasLessons = work.lessons && work.lessons.length > 0;
  const hasRadar = work.radarNodes && work.radarNodes.length > 0;
  const hasTeacherComment = !!work.teacherComment && work.teacherComment.trim().length > 0;
  const hasVideo = !!work.video && work.video.trim().length > 0;
  const hasExternal = !!work.externalUrl;
  const hasHtml = !!work.hasHtml;

  const handleShare = () => {
    setShareOpen(true);
  };

  return (
    <div className="work-detail-page">
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
          <h1 className="work-detail-title-single">{work.title}</h1>
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
            {hasHtml ? (
              <a
                className="work-detail-action-primary"
                href={`/api/camp/works/${work.slug}/html`}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开作品
                <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                  <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
                </svg>
              </a>
            ) : null}
            {hasExternal ? (
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
            ) : null}
            <button className="work-detail-action-share" type="button" onClick={handleShare}>
              分享作品
            </button>
          </div>
        </div>

        <figure className="work-detail-cover">
          {work.cover ? (
            <img
              src={work.cover}
              alt={`${work.title}项目封面`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="work-detail-cover-empty">
              <span className="mono">暂无封面</span>
              <p>{work.studentLabel} 的作品还没设置封面图</p>
            </div>
          )}
          {work.figcaption ? <figcaption>{work.figcaption}</figcaption> : null}
        </figure>
      </section>

      {hasVideo ? (
        <section className="work-video">
          <header className="work-video-heading">
            <p className="section-kicker">VIDEO / 作品介绍</p>
            <h2>看看创作者怎么讲自己的作品</h2>
          </header>
          <div className="work-video-frame">
            <video src={work.video} controls preload="metadata" playsInline />
          </div>
        </section>
      ) : null}

      {hasLessons ? (
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
                    <div className="work-log-image">
                      {lesson.image ? (
                        <img
                          src={lesson.image}
                          alt={`${lesson.time}作品截图`}
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const ph = img.nextElementSibling as HTMLElement | null;
                            if (ph) ph.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="work-log-image-placeholder"
                        style={lesson.image ? undefined : { display: 'flex' }}
                      >
                        <span>
                          {lesson.image ? '截图加载失败' : '暂未上传过程截图'}
                        </span>
                      </div>
                    </div>
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
      ) : null}

      {hasRadar ? (
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
      ) : null}

      {hasTeacherComment ? (
        <section className="work-teacher-comment">
          <header className="work-teacher-comment-heading">
            <p className="section-kicker">TEACHER / 老师点评</p>
            <h2>Alan张老师这样说</h2>
          </header>
          <blockquote className="work-teacher-comment-quote">
            <p>{work.teacherComment}</p>
            <cite>— Alan张老师</cite>
          </blockquote>
        </section>
      ) : null}

      <footer className="works-footer">
        <div className="works-footer-meta">
          <span>Alan张老师 · AI 原生教育</span>
        </div>
      </footer>

      {shareOpen ? (
        <ShareModal
          url={typeof window !== 'undefined' ? window.location.href : ''}
          title={work.shareTitle}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}
