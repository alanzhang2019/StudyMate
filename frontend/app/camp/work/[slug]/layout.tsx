import type { Metadata } from 'next';

// 对外站点域名（少年 AI 创造营 = edu.xgteacher.cn）。用于生成微信/朋友圈分享卡片
// 所需的绝对 og:url / og:image 地址。若部署域名变化，改这里即可。
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://edu.xgteacher.cn';

// 两个早期示范作品（动物迷宫 / 队形编辑器）为前端静态种子，不落库，
// 这里镜像一份最小元信息供服务端生成分享卡片。
const SEED_META: Record<string, { title: string; description: string; image: string }> = {
  'animal-maze-battle': {
    title: '动物迷宫大乱斗',
    description: '7 岁炳炳用 AI 做的游戏',
    image:
      'https://works.xgteacher.cn/media/covers/0a64a48f-2509-4698-9656-27adcbcbc565/c9bf4e08-ce07-426a-9c38-8f2e5af29a0a.png',
  },
  'formation-editor': {
    title: 'Formation 队形编辑器',
    description: '6 岁小高用 AI 做的工具',
    image:
      'https://works.xgteacher.cn/media/covers/57b7dea2-a05e-4f67-9ed9-19b47bc0bda5/0df250aa-775f-416f-ba77-820aa326fa56.png',
  },
};

export const dynamic = 'force-dynamic';

function buildMeta(
  title: string,
  description: string,
  image: string,
  url: string,
): Metadata {
  const img = image && /^https?:\/\//i.test(image) ? image : '';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      ...(img ? { images: [{ url: img }] } : {}),
    },
    twitter: {
      card: img ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(img ? { images: [img] } : {}),
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const url = `${BASE_URL}/camp/work/${slug}`;

  // 1. 静态种子作品
  const seed = SEED_META[slug];
  if (seed) {
    return buildMeta(seed.title, seed.description, seed.image, url);
  }

  // 2. 数据库作品（仅公开 approved）。动态 import + 惰性 getDb，避免构建期顶层加载原生模块。
  try {
    const { getDb } = await import('@/lib/db');
    const row = getDb()
      .prepare(
        `SELECT title, description, coverImage, studentName, grade
         FROM camp_works WHERE id = ? AND status = 'approved' LIMIT 1`,
      )
      .get(slug) as any;
    if (row) {
      const studentLabel = [row.studentName, row.grade].filter(Boolean).join(' · ');
      const description = row.description || `${studentLabel || '学员'} 的作品`;
      return buildMeta(
        row.title || '学员作品',
        description,
        row.coverImage || '',
        url,
      );
    }
  } catch (e) {
    console.error('[camp/work layout] metadata lookup failed:', e);
  }

  // 3. 兜底
  return buildMeta('学员作品', '来自 Alan张老师 · 少年 AI 创造营', '', url);
}

export default function WorkDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
