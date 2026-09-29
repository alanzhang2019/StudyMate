import { EncryptJWT, jwtDecrypt } from 'jose';
import { randomInt } from 'crypto';
import { cookies } from 'next/headers';
import { adminAesKey, isAdminConfigured } from './auth';

export const CAPTCHA_COOKIE = 'admin_captcha';
const TTL_SECONDS = 5 * 60;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export interface CaptchaIssue {
  svg: string;
  expiresIn: number;
}

export type CaptchaFailure = 'NOT_CONFIGURED' | 'MISSING' | 'INVALID' | 'MISMATCH';
export type CaptchaResult = { ok: true } | { ok: false; reason: CaptchaFailure };

/**
 * 服务端验证码。
 *
 * P0 之前 `/admin/login` 的验证码是纯前端的：answer 由浏览器 canvas 生成、
 * 也在浏览器里比对，`/api/admin/login` 完全不校验它。等于验证码只挡手写 indulge
 * 挡不住脚本 —— 直接 POST 登录接口即可绕过。
 *
 * 现在：答案在服务端生成，并用 AES-GCM 加密后放进 httpOnly cookie
 * （EncryptJWT / 'dir' / A256GCM）。客户端只能看到图片渲染结果，无法从 cookie
 * 里读出答案（不像 JWS 那样 base64 一解就能拿到明文）。
 */
function pickCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

function renderSvg(code: string): string {
  const w = 120;
  const h = 48;
  const parts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    parts.push(
      `<line x1="${randomInt(0, w)}" y1="${randomInt(0, h)}" x2="${randomInt(0, w)}" y2="${randomInt(0, h)}" ` +
        `stroke="rgb(${randomInt(0, 110)},${randomInt(0, 110)},${randomInt(0, 110)})" stroke-opacity="0.35"/>`,
    );
  }
  const colors = ['#1b56c5', '#ba7517', '#0f6e56', '#993c1d', '#534ab7', '#a32d2d'];
  for (let i = 0; i < code.length; i += 1) {
    const x = 20 + i * 26;
    const y = 26 + randomInt(-5, 6);
    const rot = randomInt(-14, 15);
    parts.push(
      `<text x="${x}" y="${y}" font-family="monospace" font-size="26" font-weight="bold" ` +
        `fill="${colors[i % colors.length]}" text-anchor="middle" ` +
        `transform="rotate(${rot} ${x} ${y})">${code[i]}</text>`,
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#f1efe8"/>${parts.join('')}</svg>`
  );
}

/** 生成一份新验证码：加密答案写入 httpOnly cookie，返回给客户端的只有 SVG 图。 */
export async function issueCaptcha(): Promise<CaptchaIssue> {
  const code = pickCode();
  const token = await new EncryptJWT({ code })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .encrypt(adminAesKey());

  (await cookies()).set(CAPTCHA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });

  return { svg: renderSvg(code), expiresIn: TTL_SECONDS };
}

/**
 * 校验用户输入的验证码。
 * 一次性：无论成功失败都立刻作废 cookie，避免同一张图被无限次重放。
 * 失败后客户端必须重新拉取新图（登录页面已处理）。
 */
export async function verifyCaptcha(input: string): Promise<CaptchaResult> {
  if (!isAdminConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };

  const store = await cookies();
  const token = store.get(CAPTCHA_COOKIE)?.value;
  if (!token) return { ok: false, reason: 'MISSING' };

  store.set(CAPTCHA_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });

  try {
    const { payload } = await jwtDecrypt(token, adminAesKey());
    const expected = String((payload as { code?: unknown })?.code ?? '');
    if (!expected) return { ok: false, reason: 'INVALID' };
    return expected.toUpperCase() === input.trim().toUpperCase()
      ? { ok: true }
      : { ok: false, reason: 'MISMATCH' };
  } catch {
    return { ok: false, reason: 'INVALID' };
  }
}
