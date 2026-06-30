'use client';

import { useEffect, useRef } from 'react';

const PROMPT_GUARD_KEY = '__promptGuard';

export type UsePromptLeavingOptions = {
  message?: string;
};

export function usePromptLeaving(when: boolean, options?: UsePromptLeavingOptions): void {
  const message = options?.message ?? '离开后当前任务会中断，确定要离开吗？';
  const whenRef = useRef(when);
  whenRef.current = when;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!when) return;

    // 1) beforeunload → 浏览器原生 confirm
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // 2) pushState 哨兵 + popstate → window.confirm
    const pushGuard = () => {
      try {
        history.pushState({ [PROMPT_GUARD_KEY]: true }, '', location.href);
      } catch {
        // ignore
      }
    };
    pushGuard();

    const onPopState = (e: PopStateEvent) => {
      if (!whenRef.current) return;
      // Only intercept when we hit our guard; otherwise let it through
      const isGuard = e.state && (e.state as Record<string, unknown>)[PROMPT_GUARD_KEY] === true;
      if (!isGuard) return;

      const ok = window.confirm(message);
      if (ok) {
        // User confirmed leaving: remove protection, then navigate back
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('pageshow', onPageShow);
        // Re-push a non-guard state so popstate won't re-trigger
        history.back();
      } else {
        // User cancelled: re-push guard, stay in place
        pushGuard();
      }
    };
    window.addEventListener('popstate', onPopState);

    // 3) BFCache recovery: re-push guard on pageshow.persisted
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        pushGuard();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [when, message]);
}
