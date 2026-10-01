/**
 * 作品源文件清单（管理端下载用）
 *
 * 学生提交的作品会落下几类文件，全部在 DB_DIR 下：
 *   camp-uploads/<id>.html   作品 HTML 源文件（camp_works.htmlFile）
 *   camp-covers/<file>       封面图 + 创作过程图（coverImage / processLogJson[].image）
 *   camp-videos/<id>.<ext>   老师上传的介绍视频（introVideoFile）
 *
 * 这个文件只做一件事：把某作品在磁盘上真实存在的素材列出来（含大小），
 * 供 /files（列清单）和 /download（单文件 / 打包 zip）两个路由共用。
 * 对外只暴露文件名与大小，不暴露服务器绝对路径。
 */

import { existsSync, statSync } from 'fs';
import { getDb } from '@/lib/db';
import {
  htmlFilePath,
  coverFilePath,
  videoFilePath,
} from '@/lib/server/camp-work-autogen';

export type WorkAssetKind = 'html' | 'cover' | 'video' | 'process';

export type WorkAsset = {
  kind: WorkAssetKind;
  /** 展示标签 */
  label: string;
  /** 下载时使用的文件名（含扩展名，保留中文标题） */
  fileName: string;
  /** 服务器绝对路径，仅服务端使用，不下发给前端 */
  absPath: string;
  size: number;
};

/** 只允许字母数字和 . _ -，杜绝路径穿越 */
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

function basenameOfServeUrl(
  url: unknown,
  prefix: string,
): string | null {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  if (!s.startsWith(prefix)) return null;
  const rest = s.slice(prefix.length).split('?')[0];
  if (!rest || !SAFE_NAME.test(rest)) return null;
  return rest;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i) : '';
}

/** 把作品标题整理成可安全出现在下载文件名里的主干（保留中文，去掉路径/引号类字符） */
export function safeFileStem(title: unknown, fallback: string): string {
  const raw = typeof title === 'string' ? title.trim() : '';
  const cleaned = raw
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function pushIfExists(
  out: WorkAsset[],
  asset: Omit<WorkAsset, 'size'>,
): void {
  try {
    if (!existsSync(asset.absPath)) return;
    out.push({ ...asset, size: statSync(asset.absPath).size });
  } catch {
    /* 读不到就当不存在 */
  }
}

/**
 * 列出某作品在磁盘上真实存在的全部素材。
 * 作品不存在或没有任何素材时返回空数组（调用方据此提示）。
 * 与审核状态无关 —— 待审核作品的管理员同样要能拿到源文件。
 */
export function collectWorkAssets(workId: string): WorkAsset[] {
  const row = getDb()
    .prepare(
      'SELECT id, title, htmlFile, coverImage, introVideoFile, processLogJson FROM camp_works WHERE id = ? LIMIT 1',
    )
    .get(workId) as
    | {
        id: string;
        title: string | null;
        htmlFile: string | null;
        coverImage: string | null;
        introVideoFile: string | null;
        processLogJson: string | null;
      }
    | undefined;

  if (!row) return [];

  const stem = safeFileStem(row.title, row.id);
  const out: WorkAsset[] = [];

  // 1. 作品 HTML 源文件
  if (row.htmlFile) {
    pushIfExists(out, {
      kind: 'html',
      label: '作品 HTML 源文件',
      fileName: `${stem}.html`,
      absPath: htmlFilePath(row.id),
    });
  }

  // 2. 封面图
  const cover = basenameOfServeUrl(row.coverImage, '/api/camp/covers/');
  if (cover) {
    pushIfExists(out, {
      kind: 'cover',
      label: '封面图',
      fileName: `${stem}-封面${extOf(cover)}`,
      absPath: coverFilePath(cover),
    });
  }

  // 3. 介绍视频（introVideoUrl 是外部直链，无法下载，只下载上传的文件）
  const video = basenameOfServeUrl(row.introVideoFile, '/api/camp/videos/');
  if (video) {
    const dot = video.lastIndexOf('.');
    const base = dot > 0 ? video.slice(0, dot) : video;
    const ext = dot > 0 ? video.slice(dot + 1) : '';
    if (SAFE_NAME.test(base) && /^[a-zA-Z0-9]{1,5}$/.test(ext)) {
      pushIfExists(out, {
        kind: 'video',
        label: '介绍视频',
        fileName: `${stem}-介绍视频.${ext}`,
        absPath: videoFilePath(base, ext),
      });
    }
  }

  // 4. 创作过程图（processLogJson[].image）
  let logs: any[] = [];
  try {
    const parsed = JSON.parse(row.processLogJson || '[]');
    if (Array.isArray(parsed)) logs = parsed;
  } catch {
    logs = [];
  }
  logs.forEach((item, i) => {
    const file = basenameOfServeUrl(item?.image, '/api/camp/covers/');
    if (!file) return;
    pushIfExists(out, {
      kind: 'process',
      label: `创作过程图 ${i + 1}`,
      fileName: `${stem}-过程图${i + 1}${extOf(file)}`,
      absPath: coverFilePath(file),
    });
  });

  return out;
}

/**
 * Content-Disposition：中文文件名必须带 filename*（RFC 5987），
 * 否则 IE/部分下载工具会拿到乱码。同时给一个纯 ASCII 的 filename 兜底。
 */
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
