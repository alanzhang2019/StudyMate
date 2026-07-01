import { describe, expect, it } from 'vitest';
import { checkRateLimit, getClientIp, _resetRateLimitBucketsForTests } from './rate-limit';
import { RateLimitedError } from './errors';

describe('checkRateLimit', () => {
  it('allows up to limit, then throws', () => {
    _resetRateLimitBucketsForTests();
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(() => checkRateLimit(key, 3, 60_000)).toThrow(RateLimitedError);
  });

  it('isolates buckets by key', () => {
    _resetRateLimitBucketsForTests();
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(() => checkRateLimit(b, 1, 60_000)).not.toThrow();
  });
});

describe('getClientIp', () => {
  it('uses first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '5.6.7.8' });
    expect(getClientIp(h)).toBe('5.6.7.8');
  });
  it('falls back to unknown', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});
