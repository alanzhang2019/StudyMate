export class RateLimitedError extends Error {
  constructor(public retryAfterSec: number) {
    super(`Rate limited; retry after ${retryAfterSec}s`);
    this.name = 'RateLimitedError';
  }
}
