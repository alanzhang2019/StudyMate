'use client';

import { useEffect, useState } from 'react';

/**
 * Lightweight in-app debug console for the WeChat / X5 crash hunt.
 *
 * Enabled when the URL contains `?debug=1` (or `?debug=true`). When
 * active it loads eruda — a ~80kb console panel that intercepts
 * `console.log` / `console.error` / `console.warn` and exposes them
 * via a floating button in the corner of the screen. Without it,
 * the WeChat WebView swallows every console call, so we have no
 * way to confirm whether the X5 guard actually fires.
 *
 * Why a custom component instead of vConsole:
 *  - eruda has zero npm-side installation cost (we load it from a
 *    CDN at runtime) so it doesn't bloat the production bundle
 *  - it ships as a single self-contained IIFE that works on
 *    WeChat's X5 kernel where vConsole sometimes refuses to init
 *  - it has a built-in "Elements" tab useful for inspecting the
 *    stage root at the moment of the crash
 *
 * To debug: open any URL on the production domain with `?debug=1`
 * appended, e.g. `https://aijiangti.cn/classroom/cm_imp_xxx?debug=1`.
 * The console button appears bottom-right. Tap it, then trigger
 * the crash — the console log will show whether `[Stage-X5-Guard]`
 * fired and what UA snippet the device reported.
 *
 * The component returns null in production (no DOM cost).
 */
export function DebugConsole() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('debug');
    setEnabled(flag === '1' || flag === 'true');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    // Avoid double-init if the user navigates client-side and the
    // component re-mounts with the same query string.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__erudaLoaded) {
      setReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.async = true;
    script.onload = () => {
      w.eruda?.init?.();
      w.__erudaLoaded = true;
      setReady(true);
      // eslint-disable-next-line no-console
      console.log('[DebugConsole] eruda ready — X5 crash diagnostic active');
    };
    script.onerror = () => {
      // eslint-disable-next-line no-console
      console.warn('[DebugConsole] eruda failed to load from CDN');
    };
    document.head.appendChild(script);
    return () => {
      // Do NOT remove the script on unmount — eruda is a global
      // singleton and tearing it down breaks any in-flight logging.
    };
  }, [enabled]);

  // Always render a tiny visual hint when debug mode is on, even
  // before eruda finishes loading, so the user knows the URL
  // parameter was recognised.
  if (!enabled) return null;
  if (ready) return null;
  return (
    <div
      data-testid="debug-console-loading"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 2147483647,
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#fff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.4,
        padding: '6px 10px',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }}
    >
      🐞 eruda 加载中…
    </div>
  );
}
