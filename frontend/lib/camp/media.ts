/**
 * 作品素材的「纯规则」层（无 Node 内置依赖，客户端组件可安全 import）。
 *
 * 服务端落盘/读文件在 lib/server/camp-work-media.ts；这里只放双方共用的
 * 类型、格式白名单、大小上限、作品形式判定等纯数据，避免前后端规则漂移。
 */

export type MediaKind = 'image' | 'video' | 'file';

export type WorkMedia = {
  kind: MediaKind;
  /** 对外服务 URL（相对站点根） */
  url: string;
  /** 用户原始文件名（已清洗，仅展示/下载用） */
  name: string;
  mime: string;
  size: number;
  ext: string;
};

export type MediaRule = { kind: MediaKind; mime: string; max: number };

const MB = 1024 * 1024;

/** 扩展名 → 类型 / MIME / 单文件上限。key 全小写，不含点。 */
export const MEDIA_RULES: Record<string, MediaRule> = {
  jpg: { kind: 'image', mime: 'image/jpeg', max: 10 * MB },
  jpeg: { kind: 'image', mime: 'image/jpeg', max: 10 * MB },
  png: { kind: 'image', mime: 'image/png', max: 10 * MB },
  gif: { kind: 'image', mime: 'image/gif', max: 10 * MB },
  webp: { kind: 'image', mime: 'image/webp', max: 10 * MB },
  mp4: { kind: 'video', mime: 'video/mp4', max: 80 * MB },
  webm: { kind: 'video', mime: 'video/webm', max: 80 * MB },
  mov: { kind: 'video', mime: 'video/quicktime', max: 80 * MB },
  m4v: { kind: 'video', mime: 'video/mp4', max: 80 * MB },
  pdf: { kind: 'file', mime: 'application/pdf', max: 30 * MB },
  ppt: { kind: 'file', mime: 'application/vnd.ms-powerpoint', max: 30 * MB },
  pptx: {
    kind: 'file',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    max: 30 * MB,
  },
  doc: { kind: 'file', mime: 'application/msword', max: 30 * MB },
  docx: {
    kind: 'file',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    max: 30 * MB,
  },
  zip: { kind: 'file', mime: 'application/zip', max: 30 * MB },
};

export const MEDIA_LIMITS = {
  /** 单次提交最多多少个附件 */
  maxFiles: 12,
  /** 单次提交总体积（nginx client_max_body_size 为 200M，留余量） */
  maxTotal: 150 * MB,
  maxImage: 8,
  maxVideo: 2,
  maxFile: 4,
};

/** <input type="file" accept> 用 */
export const MEDIA_ACCEPT = Object.keys(MEDIA_RULES)
  .map((e) => `.${e}`)
  .join(',');

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function classifyMedia(name: string): { ext: string; rule: MediaRule } | null {
  const ext = extOf(name);
  const rule = MEDIA_RULES[ext];
  return rule ? { ext, rule } : null;
}

export function cleanDisplayName(name: string, fallback: string): string {
  const raw = (name || '')
    .replace(/[\\/\r\n\t]+/g, '_')
    .replace(/[<>:"|?*]+/g, '_')
    .slice(0, 120)
    .trim();
  return raw || fallback;
}

export function mediaServeUrl(workId: string, seq: number, ext: string): string {
  return `/api/camp/works/${workId}/media/${seq}.${ext}`;
}

/** 作品形式：给作品墙角标 / 详情页判断展示方式 */
export function workKindOf(opts: {
  hasHtml: boolean;
  media: WorkMedia[];
}): string {
  if (opts.hasHtml) return 'html';
  if (opts.media.some((m) => m.kind === 'video')) return 'video';
  if (opts.media.some((m) => m.kind === 'image')) return 'image';
  if (opts.media.some((m) => m.kind === 'file')) return 'file';
  return 'text';
}

export const WORK_KIND_LABEL: Record<string, string> = {
  html: '🌐 网页作品',
  video: '🎬 视频介绍',
  image: '🖼️ 图片展示',
  file: '📎 作品附件',
  text: '✍️ 文字作品',
};

export function firstImageUrl(media: WorkMedia[]): string {
  return media.find((m) => m.kind === 'image')?.url || '';
}

export function firstVideoUrl(media: WorkMedia[]): string {
  return media.find((m) => m.kind === 'video')?.url || '';
}

export function parseMediaJson(raw: unknown): WorkMedia[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is WorkMedia =>
        !!m &&
        typeof m === 'object' &&
        typeof m.url === 'string' &&
        m.url.startsWith('/api/camp/works/') &&
        ['image', 'video', 'file'].includes(m.kind),
    );
  } catch {
    return [];
  }
}

/** 路由参数校验：workId 是 UUID，文件名是 <seq>.<ext> */
export const WORK_ID_RE = /^[a-f0-9-]{36}$/i;
export const MEDIA_FILENAME_RE = /^(\d{1,2})\.([a-z0-9]{1,5})$/i;

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  image: '图片',
  video: '视频',
  file: '附件',
};

export function formatMediaSize(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}
