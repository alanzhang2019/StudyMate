import { NextRequest } from 'next/server';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { withAdminAuth } from '@/lib/admin/with-auth';
import {
  MIN_PASSWORD_LENGTH,
  getAdminIdentity,
  verifyAdminPassword,
} from '@/lib/admin/auth';
import {
  hashPassword,
  readStoredAdminCreds,
  writeStoredAdminCreds,
} from '@/lib/admin/credentials-store';

const MAX_PASSWORD_LENGTH = 128;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

// GET /api/admin/password —— 当前凭据概况（账号名、来源、上次修改时间）
export const GET = withAdminAuth(async () => {
  const id = getAdminIdentity();
  return apiSuccess({
    username: id.username,
    source: id.source, // custom = 后台改过；env = 仍用环境变量
    updatedAt: id.updatedAt,
    minLength: MIN_PASSWORD_LENGTH,
  });
});

/**
 * POST /api/admin/password —— 修改管理员账号/密码
 *
 * body: { currentPassword, newPassword, confirmPassword, username? }
 *
 * 新凭据写进持久卷 DATA_DIR/admin-credentials.json（bcrypt 散列，不存明文），
 * 优先级高于环境变量，容器重建不丢。同时把令牌代次 epoch +1，
 * 使所有已签发的旧令牌（含可能已泄露的）立即失效。
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  let body: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    username?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求格式有误');
  }

  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  const confirm = String(body.confirmPassword || '');

  if (!current || !next || !confirm) {
    return apiError('MISSING_REQUIRED_FIELD', 400, '请填写当前密码、新密码和确认密码');
  }
  if (next !== confirm) {
    return apiError('INVALID_REQUEST', 400, '两次输入的新密码不一致');
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return apiError(
      'INVALID_REQUEST',
      400,
      `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`,
    );
  }
  if (next.length > MAX_PASSWORD_LENGTH) {
    return apiError('INVALID_REQUEST', 400, '新密码过长');
  }
  if (next === current) {
    return apiError('INVALID_REQUEST', 400, '新密码不能与当前密码相同');
  }

  const identity = getAdminIdentity();
  if (!identity.username) {
    return apiError('INTERNAL_ERROR', 503, '当前管理员账号未配置，无法修改');
  }

  // 改名可选：不填则沿用当前账号
  let nextUsername = identity.username;
  if (body.username !== undefined && String(body.username).trim()) {
    const candidate = String(body.username).trim();
    if (!USERNAME_RE.test(candidate)) {
      return apiError(
        'INVALID_REQUEST',
        400,
        '账号名只能包含字母、数字、点、下划线、连字符，长度 3-32',
      );
    }
    nextUsername = candidate;
  }

  // 必须验证当前密码，防止拿到会话的人直接改密接管
  const check = verifyAdminPassword(identity.username, current);
  if (check !== 'ok') {
    return apiError('INVALID_REQUEST', 400, '当前密码不正确');
  }

  const prev = readStoredAdminCreds();
  try {
    writeStoredAdminCreds({
      username: nextUsername,
      passwordHash: hashPassword(next),
      epoch: (prev?.epoch ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      `保存失败：${e?.message || '数据目录不可写'}`,
    );
  }

  return apiSuccess({
    username: nextUsername,
    updatedAt: new Date().toISOString(),
    sessionsInvalidated: true,
  });
});
