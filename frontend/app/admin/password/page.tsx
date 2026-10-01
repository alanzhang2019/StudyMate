'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 管理端修改密码。
 *
 * 凭据原本只在环境变量里，改一次要动服务器 .env 再重建容器，实际上没法改。
 * 现在改密写进持久卷里的 admin-credentials.json（bcrypt 散列），
 * 优先级高于环境变量，重建不丢；同时令牌代次 +1，其他已登录会话全部下线。
 */

type Identity = {
  username: string | null;
  source: 'custom' | 'env' | 'unconfigured';
  updatedAt: string | null;
  minLength: number;
};

export default function AdminPasswordPage() {
  const router = useRouter();
  const [id, setId] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/password', { cache: 'no-store' });
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      // 注意：apiSuccess 是扁平返回（{success, username, ...}），不套 data 层
      const data: Identity = {
        username: json.username ?? null,
        source: json.source ?? 'unconfigured',
        updatedAt: json.updatedAt ?? null,
        minLength: json.minLength ?? 12,
      };
      setId(data);
      setUsername(data.username || '');
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError(null);
    setOk(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写当前密码、新密码和确认密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (id && newPassword.length < id.minLength) {
      setError(`新密码至少需要 ${id.minLength} 个字符`);
      return;
    }
    if (newPassword === currentPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
          username,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setOk('密码已更新，其他已登录的会话已全部下线。下次登录请用新密码。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await load();
    } catch (e: any) {
      setError(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">修改管理员密码</h1>
        <p className="text-sm text-gray-500 mt-1">
          修改后立即生效，无需重建服务；其他已登录的会话会被强制下线。
        </p>
      </div>

      {loading ? (
        <div className="bg-white border rounded-lg p-6 text-sm text-gray-500">
          正在读取… 
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-6 space-y-5">
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              当前账号：<span className="font-medium text-gray-900">{id?.username || '—'}</span>
            </div>
            <div>
              凭据来源：
              {id?.source === 'custom' ? (
                <span className="text-green-700">后台自定义（持久卷，重建不丢）</span>
              ) : id?.source === 'env' ? (
                <span className="text-amber-700">环境变量初始值（尚未改过）</span>
              ) : (
                <span className="text-red-600">未配置</span>
              )}
            </div>
            {id?.updatedAt ? (
              <div className="text-xs text-gray-400">
                上次修改：{new Date(id.updatedAt).toLocaleString('zh-CN')}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              账号名（可留空保持不变）
            </label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alan-admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              当前密码
            </label>
            <input
              type="password"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新密码（至少 {id?.minLength ?? 12} 位）
            </label>
            <input
              type="password"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              确认新密码
            </label>
            <input
              type="password"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {ok ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {ok}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? '保存中…' : '保存新密码'}
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>
          新密码以 bcrypt 散列保存在数据卷中，不存明文，也不会写进代码仓库。
        </p>
        <p>
          若忘记密码，删除服务器数据卷中的{' '}
          <code className="bg-gray-100 px-1 rounded">admin-credentials.json</code>{' '}
          即可回退到环境变量里的初始凭据。
        </p>
      </div>
    </div>
  );
}
