import { SignJWT, jwtVerify } from 'jose';
import { createHash, timingSafeEqual } from 'crypto';
import {
  readStoredAdminCreds,
  verifyAgainstHash,
} from './credentials-store';

const MIN_SECRET_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 12;
const ADMIN_TOKEN_TTL = '24h';

/** 先 SHA-256 再比较：长度恒定，避免 timingSafeEqual 前的长度判断泄漏长度信息。 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * 当前令牌代次。自定义凭据里带 epoch，每次改密 +1；
 * 未自定义（走环境变量）时恒为 0。
 */
function currentEpoch(): number {
  return readStoredAdminCreds()?.epoch ?? 0;
}

/**
 * 管理端令牌签名 / 校验。
 *
 * P0 安全加固前的实现是：
 *   process.env.ADMIN_JWT_SECRET || 'fallback_secret_for_dev_only_123456'
 * 一个写死在源码里的兜底密钥。任何人只要读过这份代码（或猜到部署者没配
 * 环境变量），就能用已知密钥自行签发合法 `admin_token` 直接进后台。
 *
 * 现在一律 fail-closed：密钥缺失/过短一律拒绝签发与校验，
 * 绝不回退到可猜测的默认值。
 */
function readSecret(): string {
  const raw = process.env.ADMIN_JWT_SECRET;
  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ADMIN_JWT_SECRET 未配置或长度不足 ${MIN_SECRET_LENGTH} 字符，拒绝以弱密钥处理管理端令牌`,
    );
  }
  return raw;
}

/** 供路由判断「管理端是否已正确配置」，用于返回可操作的 503 而不是含糊的 401。 */
export function isAdminConfigured(): boolean {
  const raw = process.env.ADMIN_JWT_SECRET;
  return Boolean(raw && raw.length >= MIN_SECRET_LENGTH);
}

/** 由主密钥派生 32 字节 AES-GCM 密钥，用于加密验证码挑战（防客户端读出明文答案）。 */
export function adminAesKey(): Uint8Array {
  return new Uint8Array(createHash('sha256').update(readSecret()).digest());
}

export async function signAdminToken() {
  return new SignJWT({ role: 'admin', epoch: currentEpoch() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ADMIN_TOKEN_TTL)
    .sign(new TextEncoder().encode(readSecret()));
}

/**
 * 校验通过返回 payload，任何失败一律返回 null（不再抛异常）。
 *
 * 重要：调用方必须显式判断 null 来判定「未授权」。过去 verifyAdminToken 只靠
 * 抛异常表达失败、with-auth.ts 用 try/catch 包住 —— 一旦实现改成不抛异常就会
 * 静默放行。因此本次同步改了 with-auth.ts，让它必检返回值。
 */
export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(readSecret()));
    if (payload?.role !== 'admin') return null;
    // 代次校验：改过密码后旧令牌一律失效（旧令牌没有 epoch 时按 0 处理）
    const tokenEpoch = typeof payload.epoch === 'number' ? payload.epoch : 0;
    if (tokenEpoch !== currentEpoch()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 当前生效的管理员账号与凭据来源，供后台展示（不下发密码相关信息）。 */
export function getAdminIdentity(): {
  username: string | null;
  source: 'custom' | 'env' | 'unconfigured';
  updatedAt: string | null;
} {
  const stored = readStoredAdminCreds();
  if (stored) {
    return {
      username: stored.username,
      source: 'custom',
      updatedAt: stored.updatedAt || null,
    };
  }
  const envUser = process.env.ADMIN_USERNAME;
  return {
    username: envUser || null,
    source: envUser ? 'env' : 'unconfigured',
    updatedAt: null,
  };
}

/**
 * 校验登录账号密码。
 * 自定义凭据（文件，bcrypt）优先；否则回退环境变量（明文比较，已做定时安全）。
 * 返回 unconfigured 表示环境变量也没配 —— 调用方应返回 503 而不是 401。
 */
export function verifyAdminPassword(
  username: string,
  password: string,
): 'ok' | 'bad' | 'unconfigured' {
  const stored = readStoredAdminCreds();
  if (stored) {
    const userOk = safeEqual(username, stored.username);
    const passOk = verifyAgainstHash(password, stored.passwordHash);
    return userOk && passOk ? 'ok' : 'bad';
  }

  let expected: { username: string; password: string };
  try {
    expected = requireAdminCredentials();
  } catch {
    return 'unconfigured';
  }
  return safeEqual(username, expected.username) && safeEqual(password, expected.password)
    ? 'ok'
    : 'bad';
}

/**
 * 读取管理员凭据。未配置时抛错，调用方应返回 503 并提示配置环境变量
 * ——不允许回退到默认口令。
 */
export function requireAdminCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME / ADMIN_PASSWORD 未配置');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD 长度需不少于 ${MIN_PASSWORD_LENGTH} 个字符`);
  }
  return { username, password };
}
