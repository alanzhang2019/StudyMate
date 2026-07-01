import { RateLimitedError } from './errors';

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (bucket.timestamps.length && bucket.timestamps[0] < cutoff) {
    bucket.timestamps.shift();
  }
}

export function checkRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    throw new RateLimitedError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }
  bucket.timestamps.push(now);
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

export function _resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
