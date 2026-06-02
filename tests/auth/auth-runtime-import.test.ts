import { describe, expect, it } from 'vitest';

describe.skip('auth runtime import', () => {
  it('exports handlers', async () => {
    const authModule = await import('../../auth');
    expect(authModule.handlers).toBeTruthy();
    expect(typeof authModule.handlers.GET).toBe('function');
    expect(typeof authModule.handlers.POST).toBe('function');
  });
});
