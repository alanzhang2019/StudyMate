import { getDb } from '@/lib/db';
import { isSeedWorkSlug } from '@/lib/camp/seed-works';

/**
 * 作品「讨论区 + 评分」的读写工具。
 *
 * 设计取舍：
 * - 完全匿名：不需要登录，昵称随手填（默认「匿名访客」），身份只认
 *   httpOnly cookie 里的 sm_visitor_id。这是 K12 作品墙，门槛越低越好，
 *   但同一浏览器对同一作品仍只有一票评分（复合主键 UPSERT）。
 * - 只服务公开作品：未通过审核的作品不允许讨论，避免绕过审核传播。
 * - 种子作品（不落库的两个静态示范作品）按 slug 放行，见 seed-works.ts。
 */

export const COMMENT_MAX_LEN = 500;
export const NAME_MAX_LEN = 24;

export type PublicComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type RatingSummary = {
  /** 平均分，保留一位小数；无人评分为 0 */
  avg: number;
  count: number;
  /** 当前访客自己打的分，未打为 null */
  mine: number | null;
  /** 1-5 分各自的人数 */
  dist: Record<1 | 2 | 3 | 4 | 5, number>;
};

/** 作品是否可被公开讨论（已审核通过，或为静态种子作品） */
export function workIsDiscussable(workId: string): boolean {
  if (isSeedWorkSlug(workId)) return true;
  try {
    const row = getDb()
      .prepare("SELECT id FROM camp_works WHERE id = ? AND status = 'approved' LIMIT 1")
      .get(workId) as { id: string } | undefined;
    return !!row;
  } catch {
    return false;
  }
}

export function listComments(workId: string, visitorId: string | null): PublicComment[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT id, parentId, authorName, authorRole, authorVisitorId, body, createdAt
         FROM camp_work_comments
         WHERE workId = ? AND status = 'visible'
         ORDER BY createdAt ASC`,
      )
      .all(workId) as Array<{
      id: string;
      parentId: string | null;
      authorName: string;
      authorRole: string | null;
      authorVisitorId: string | null;
      body: string;
      createdAt: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId || null,
      authorName: r.authorName,
      authorRole: r.authorRole || 'guest',
      body: r.body,
      createdAt: r.createdAt,
      // 只有本人能删自己的评论；visitorId 为空（异常数据）时一律不可删
      mine: !!visitorId && !!r.authorVisitorId && r.authorVisitorId === visitorId,
    }));
  } catch (e) {
    console.error('[camp-discussion] listComments failed:', e);
    return [];
  }
}

export function ratingSummary(workId: string, visitorId: string | null): RatingSummary {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT score FROM camp_work_ratings WHERE workId = ?')
      .all(workId) as Array<{ score: number }>;

    let sum = 0;
    for (const r of rows) {
      const s = Math.round(Number(r.score));
      if (s >= 1 && s <= 5) {
        dist[s as 1 | 2 | 3 | 4 | 5] += 1;
        sum += s;
      }
    }
    const count = rows.length;
    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    let mine: number | null = null;
    if (visitorId) {
      const mineRow = db
        .prepare('SELECT score FROM camp_work_ratings WHERE workId = ? AND visitorId = ? LIMIT 1')
        .get(workId, visitorId) as { score: number } | undefined;
      if (mineRow) mine = Math.round(Number(mineRow.score));
    }

    return { avg, count, mine, dist };
  } catch (e) {
    console.error('[camp-discussion] ratingSummary failed:', e);
    return { avg: 0, count: 0, mine: null, dist };
  }
}

/** 批量取多个作品的评分/评论概览，用于作品墙列表（避免 N+1）。 */
export function ratingSummaryForMany(
  workIds: string[],
): Record<string, { avg: number; count: number; commentCount: number }> {
  const out: Record<string, { avg: number; count: number; commentCount: number }> = {};
  if (workIds.length === 0) return out;
  try {
    const db = getDb();
    const placeholders = workIds.map(() => '?').join(',');

    const ratingRows = db
      .prepare(
        `SELECT workId, COUNT(*) AS c, AVG(score) AS a
         FROM camp_work_ratings WHERE workId IN (${placeholders})
         GROUP BY workId`,
      )
      .all(...workIds) as Array<{ workId: string; c: number; a: number }>;

    const commentRows = db
      .prepare(
        `SELECT workId, COUNT(*) AS c
         FROM camp_work_comments WHERE workId IN (${placeholders}) AND status = 'visible'
         GROUP BY workId`,
      )
      .all(...workIds) as Array<{ workId: string; c: number }>;

    for (const r of ratingRows) {
      out[r.workId] = {
        avg: Math.round(Number(r.a) * 10) / 10,
        count: Number(r.c),
        commentCount: 0,
      };
    }
    for (const r of commentRows) {
      if (out[r.workId]) out[r.workId].commentCount = Number(r.c);
      else out[r.workId] = { avg: 0, count: 0, commentCount: Number(r.c) };
    }
  } catch (e) {
    console.error('[camp-discussion] ratingSummaryForMany failed:', e);
  }
  return out;
}

/**
 * 评论限流（进程内滑动窗口）。
 * 讨论区完全匿名，只靠这个 + 每作品每访客一票评分来防灌水。
 * 多实例部署时窗口不共享，但作品墙是单容器，够用。
 */
const COMMENT_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_MAX_PER_WINDOW = 5;
const COMMENT_MIN_INTERVAL_MS = 5 * 1000;

const commentHits = new Map<string, number[]>();

export function commentRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = (commentHits.get(key) ?? []).filter((t) => now - t < COMMENT_WINDOW_MS);
  if (bucket.length >= COMMENT_MAX_PER_WINDOW) {
    commentHits.set(key, bucket);
    return true;
  }
  const last = bucket[bucket.length - 1];
  if (last && now - last < COMMENT_MIN_INTERVAL_MS) {
    commentHits.set(key, bucket);
    return true;
  }
  bucket.push(now);
  commentHits.set(key, bucket);
  // 顺手清理，避免 Map 无界增长
  if (commentHits.size > 5000) {
    for (const [k, v] of commentHits) {
      if (!v.length || now - v[v.length - 1] > COMMENT_WINDOW_MS) commentHits.delete(k);
    }
  }
  return false;
}

/** 昵称清洗：去掉换行/控制字符，超长截断，空则给默认名。 */
export function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const cleaned = s.replace(/[\r\n\t]/g, ' ').trim().slice(0, NAME_MAX_LEN);
  return cleaned || '匿名访客';
}

/** 评论正文清洗：去掉控制字符（保留换行），压缩连续空行，超长截断。 */
export function cleanBody(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const cleaned = s
    .replace(/\r\n?/g, '\n')
    // 去掉除换行/制表符外的控制字符
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, COMMENT_MAX_LEN);
  return cleaned;
}
