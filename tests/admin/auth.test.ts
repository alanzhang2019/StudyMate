import { describe, it, expect } from 'vitest';
import { signAdminToken, verifyAdminToken } from '../../lib/admin/auth';

describe('Admin Auth Utils', () => {
  it('should sign and verify a token', async () => {
    const token = await signAdminToken();
    const payload = await verifyAdminToken(token);
    expect(payload).toBeDefined();
    expect(payload.role).toBe('admin');
  });

  it('should fail on invalid token', async () => {
    await expect(verifyAdminToken('invalid')).rejects.toThrow();
  });
});
