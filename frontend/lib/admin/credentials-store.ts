/**
 * 管理员凭据持久化（供后台「修改密码」使用）
 *
 * 凭据原本只来自环境变量 ADMIN_USERNAME / ADMIN_PASSWORD —— 改一次密码就要
 * 改服务器上的 .env 再重建容器，实际没人这么干，于是「改密码」事实上不可用。
 *
 * 这里把自定义凭据写进 DATA_DIR/admin-credentials.json：
 *   - DATA_DIR 就是持久卷（生产 = /app/data），容器重建、换镜像都不丢；
 *   - 优先级：文件 > 环境变量。文件存在时以文件为准，删掉文件即回退到环境变量，
 *     这是忘记密码时的兜底恢复手段（登录服务器删这个文件即可）。
 *   - 密码只存 bcrypt 散列，不存明文。
 *
 * epoch 是「令牌代次」：每次改密 +1，签发的令牌带上当前代次，校验时代次
 * 不符即失效 —— 改密后所有已登录的会话（含可能已泄露的旧令牌）全部下线。
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';
const CRED_PATH = path.join(DATA_DIR, 'admin-credentials.json');
const TMP_PATH = `${CRED_PATH}.tmp`;

const BCRYPT_COST = 10; // 与 NextAuth 注册链路保持一致

export type StoredAdminCreds = {
  username: string;
  /** bcrypt 散列，绝不存明文 */
  passwordHash: string;
  /** 令牌代次，改密后旧令牌失效 */
  epoch: number;
  updatedAt: string;
};

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyAgainstHash(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/** 读取自定义凭据；不存在、损坏、字段不全一律返回 null（视为「未自定义」）。 */
export function readStoredAdminCreds(): StoredAdminCreds | null {
  try {
    if (!existsSync(CRED_PATH)) return null;
    const raw = JSON.parse(readFileSync(CRED_PATH, 'utf-8'));
    if (!raw || typeof raw.username !== 'string' || !raw.username) return null;
    if (typeof raw.passwordHash !== 'string' || !raw.passwordHash) return null;
    return {
      username: raw.username,
      passwordHash: raw.passwordHash,
      epoch: typeof raw.epoch === 'number' ? raw.epoch : 0,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    };
  } catch {
    return null;
  }
}

/** 原子写入（先写临时文件再 rename），避免写到一半被读到。 */
export function writeStoredAdminCreds(creds: StoredAdminCreds): void {
  writeFileSync(TMP_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  renameSync(TMP_PATH, CRED_PATH);
}

/** 删除自定义凭据，回退到环境变量（忘记密码时的恢复手段）。 */
export function clearStoredAdminCreds(): void {
  try {
    if (existsSync(CRED_PATH)) unlinkSync(CRED_PATH);
  } catch {
    /* 删不掉就让上层报错 */
  }
}

export function credsFilePath(): string {
  return CRED_PATH;
}
