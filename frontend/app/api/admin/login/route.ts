import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { signAdminToken } from '@/lib/admin/auth';
import { trackEvent } from '@/lib/usage/track';

export async function POST(request: Request) {
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  }

  if (!body.username || !body.password) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'Username and password are required');
  }

  const encoder = new TextEncoder();
  const inputUsername = encoder.encode(body.username);
  const inputPassword = encoder.encode(body.password);
  const expectedUsername = encoder.encode(validUsername);
  const expectedPassword = encoder.encode(validPassword);

  let isValid = true;

  if (inputUsername.byteLength !== expectedUsername.byteLength || !timingSafeEqual(inputUsername, expectedUsername)) {
    isValid = false;
  }

  if (inputPassword.byteLength !== expectedPassword.byteLength || !timingSafeEqual(inputPassword, expectedPassword)) {
    isValid = false;
  }

  if (!isValid) {
    return apiError('INVALID_REQUEST', 401, 'Invalid credentials');
  }

  const token = await signAdminToken();
  const cookieStore = await cookies();

  cookieStore.set('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    secure: process.env.NODE_ENV === 'production',
  });

  void trackEvent('admin.login', { username: validUsername });

  return apiSuccess({ valid: true });
}
