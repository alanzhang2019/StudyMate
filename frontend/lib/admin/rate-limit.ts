const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_KEYS = 5000;

/**
 * 管理端登录限流（进程内滑动窗口）。
 *
 * 作用域说明：这是单实例内存态计数 —— 本项目前端以单个容器运行，够用；
 * 若将来水平扩容到多副本，需换成共享存储（Redis / SQLite）计数，
 * 届时每个副本各自计数会让实际阈值翻倍。
 */
const attempts = new Map<string, number[]>();

function prune(now: number): void {
  if (attempts.size === 0) return;
  for (const [key, stamps] of attempts) {
    const alive = stamps.filter((t) => now - t < WINDOW_MS);
    if (alive.length === 0) attempts.delete(key);
    else if (alive.length !== stamps.length) attempts.set(key, alive);
  }
  // 兜底防止被大量不同 IP 打爆内存
  if (attempts.size > MAX_TRACKED_KEYS) {
    const drop = attempts.size - MAX_TRACKED_KEYS;
    let dropped = 0;
    for (const key of attempts.keys()) {
      if (dropped >= drop) break;
      attempts.delete(key);
      dropped += 1;
    }
  }
}

/** 取请求来源 IP（尊重反向代理的 X-Forwarded-For / X-Real-IP）。 */
export function clientKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  const ip = xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

/** 记录一次尝试并判断是否在阈值内。 */
export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(key, list);
  prune(now);

  if (list.length > MAX_ATTEMPTS) {
    const oldest = list[0];
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** 登录成功后清空该来源的失败计数。 */
export function resetLoginAttempts(key: string): void {
  attempts.delete(key);
}
