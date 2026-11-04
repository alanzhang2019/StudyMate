/**
 * 学生上传的非 HTML 作品素材 —— 服务端落盘层。
 *
 * 纯规则（格式白名单 / 大小上限 / 作品形式 / URL 拼接）在 @/lib/camp/media，
 * 客户端组件也 import 那一份；本文件只负责 Node 文件系统操作，并原样
 * re-export 纯规则，让既有调用方（api/camp/works 等）保持单一入口。
 *
 * 落盘：<DATA_DIR>/camp-media/<workId>/<seq>.<ext>
 * 对外：/api/camp/works/<workId>/media/<seq>.<ext>（见对应 route.ts，带审核鉴权）
 *
 * 安全：磁盘文件名一律由服务端生成（序号 + 白名单扩展名），绝不用用户文件名。
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export * from '@/lib/camp/media';

const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';
const MEDIA_ROOT = path.join(DATA_DIR, 'camp-media');

export function mediaDir(workId: string): string {
  return path.join(MEDIA_ROOT, workId);
}

export function mediaFilePath(workId: string, seq: number, ext: string): string {
  return path.join(mediaDir(workId), `${seq}.${ext}`);
}

export function saveMediaFile(
  workId: string,
  seq: number,
  ext: string,
  buf: Buffer,
): void {
  const dir = mediaDir(workId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(mediaFilePath(workId, seq, ext), buf);
}
