import { describe, expect, it } from 'vitest';
import { normalizeFetchErrorMessage } from '@/lib/mistake/ui/normalize-fetch-error';

describe('normalizeFetchErrorMessage', () => {
  it('maps Failed to fetch to a helpful tunnel hint', () => {
    const message = normalizeFetchErrorMessage(new TypeError('Failed to fetch'), {
      fileSizes: [3 * 1024 * 1024],
    });

    expect(message).toContain('Failed to fetch');
    expect(message).toContain('花生壳');
    expect(message).toContain('3.00MB');
  });

  it('returns original error message for non-network errors', () => {
    const message = normalizeFetchErrorMessage(new Error('bad request'));
    expect(message).toBe('bad request');
  });
});
