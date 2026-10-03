'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessCodeModal } from '@/components/access-code-modal';

interface AccessCodeGuardProps {
  children: ReactNode;
  /**
   * 服务端渲染期读到的门禁开关（`process.env.ACCESS_CODE`）。
   * 仅用于决定「状态未知时能否先把内容渲染出来」：
   * 静态页在构建期求值，动态页在请求期求值，所以它只是提示，
   * 真正的判定始终以 `/api/access-code/status` 的运行时结果为准。
   */
  enabled?: boolean;
}

interface AccessStatus {
  enabled: boolean;
  authenticated: boolean;
  loading: boolean;
}

/** 状态接口连续失败时的重试次数 */
const MAX_ATTEMPTS = 3;

export function AccessCodeGuard({ children, enabled = false }: AccessCodeGuardProps) {
  const [status, setStatus] = useState<AccessStatus>({
    enabled,
    authenticated: false,
    loading: true,
  });

  const check = useCallback(async () => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        // cache: 'no-store' —— 门禁状态绝不能走浏览器缓存，
        // 否则开关密码后旧结果会被复用。
        const res = await fetch('/api/access-code/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { enabled?: boolean; authenticated?: boolean };
        setStatus({
          enabled: !!data.enabled,
          authenticated: !!data.authenticated,
          loading: false,
        });
        return;
      } catch {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }

    // 连续失败：无法确认门禁状态时「不放行」（fail-closed）。
    // 这不会把「本就没配密码」的站点锁死：服务端未配置 ACCESS_CODE 时，
    // POST /api/access-code/verify 会直接返回 valid=true，输入任意内容即可进入。
    setStatus({ enabled: true, authenticated: false, loading: false });
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // 1) 状态未知：门禁已知开启时只显示占位，绝不先把内容送进 DOM。
  if (status.loading) {
    return enabled ? (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在校验访问权限…
      </div>
    ) : (
      <>{children}</>
    );
  }

  // 2) 已启用门禁且未通过：只渲染弹窗，children 完全不进入 DOM。
  if (status.enabled && !status.authenticated) {
    return (
      <AccessCodeModal
        open
        onSuccess={() => setStatus((s) => ({ ...s, authenticated: true }))}
      />
    );
  }

  // 3) 未启用门禁，或已通过校验：正常渲染。
  return <>{children}</>;
}
