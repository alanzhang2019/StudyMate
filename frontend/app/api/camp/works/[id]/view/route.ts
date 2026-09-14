import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getClientIp } from '@/lib/integrations/rate-limit';

/**
 * POST /api/camp/works/:id/view —— 作品详情页浏览计数（公开，无需登录）
 *
 * 用于作品墙「最热」排序。「最热」此前是坏的：前端把 views 写死为 0，
 * 导致排序恒等于 0 的比较，点「最热」等于没排。这里补上真实计数。
 *
 * 防刷策略（两道）：
 * 1. 去重窗口：同一 IP + 同一作品，DEDUP_WINDOW_MS 内只计一次。
 *    正常用户反复刷新详情页不会灌水；不同 IP 仍各自计入。
 * 2. 兜底节流：同一 IP 每分钟最多 MAX_HITS_PER_MIN 次不同作品的计数，
 *    防止脚本遍历全站作品刷量。
 *
 * 只对 status='approved' 的作品计数，与公开可见性保持一致。
 */

const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 小时
const MAX_HITS_PER_MIN = 30;

/** key = `${ip}:${workId}` → 上次计入的时间戳 */
const seen = new Map<string, number>();

/** key = ip → 最近一分钟内的计数时间戳 */
const hits = new Map<string, number[]>();

function pruneDedup(now: number) {
  // 顺手清理过期条目，避免 Map 长期增长。
  // 用一个粗略阈值：超过窗口两倍没访问的记录直接丢掉。
  for (const [k, t] of seen) {
    if (now - t > DEDUP_WINDOW_MS * 2) seen.delete(k);
  }
}

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const now = Date.now();
    const ip = getClientIp(req.headers);

    // 1) 作品必须存在且已通过审核
    const row = getDb()
      .prepare('SELECT id, status FROM camp_works WHERE id = ? LIMIT 1')
      .get(id) as { id: string; status: string } | undefined;

    if (!row || row.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }

    // 2) 兜底节流：同一 IP 每分钟最多 MAX_HITS_PER_MIN 次
    const bucket = hits.get(ip) ?? [];
    const cutoff = now - 60_000;
    while (bucket.length && bucket[0] < cutoff) bucket.shift();
    if (bucket.length >= MAX_HITS_PER_MIN) {
      // 超限不算失败：返回 ok=false 让前端静默忽略，不打断阅读。
      return NextResponse.json({ success: true, counted: false, reason: 'throttled' });
    }

    // 3) 去重窗口：同一 IP + 同一作品 6 小时内只计一次
    const dedupKey = `${ip}:${id}`;
    const last = seen.get(dedupKey);
    if (last && now - last < DEDUP_WINDOW_MS) {
      return NextResponse.json({ success: true, counted: false, reason: 'deduped' });
    }

    seen.set(dedupKey, now);
    bucket.push(now);
    hits.set(ip, bucket);
    if (seen.size > 5000) pruneDedup(now);

    const result = getDb()
      .prepare(
        'UPDATE camp_works SET viewCount = viewCount + 1 WHERE id = ? AND status = ?',
      )
      .run(id, 'approved');

    const viewCount = (
      getDb()
        .prepare('SELECT viewCount FROM camp_works WHERE id = ? LIMIT 1')
        .get(id) as { viewCount: number } | undefined
    )?.viewCount;

    return NextResponse.json({
      success: true,
      counted: result.changes > 0,
      viewCount: viewCount ?? 0,
    });
  } catch (error) {
    console.error('[camp/works/:id view POST] error:', error);
    // 计数失败不应影响页面浏览，返回 200 让前端静默忽略
    return NextResponse.json({ success: true, counted: false, reason: 'error' });
  }
};
