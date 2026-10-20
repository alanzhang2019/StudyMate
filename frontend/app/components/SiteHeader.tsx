'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/app/components/ThemeToggle';

// 顶部导航只保留三项：AI 原生教育 / 信息学奥赛 / 工具箱。
// 原来导航上有 6 个按钮（含深圳教材、资料共享、智能错题本、AI 自学），
// 窄屏会 flex-wrap 挤成两排、把 Hero 顶下去。现在把工具类入口统一收进
// 工具箱下拉，「AI 自学」不再单列 —— 首页本身就是 AI 自学页。
//
// 注意：本文件因此从 server component 变成 client component（下拉要交互）。
// 首页是 force-static 的静态页，client component 在里面照常 SSR + 水合，没问题。
const TOOLS = [
  { href: '/textbooks', label: '深圳教材', icon: '📖', external: false },
  { href: '/clipboard', label: '资料共享', icon: '📋', external: false },
  { href: 'https://aijiangti.cn/wrong-notebook/', label: '智能错题本', icon: '📓', external: true },
];

function ToolboxMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="gap-1"
      >
        <Wrench className="w-4 h-4" aria-hidden="true" />
        工具箱
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden z-50"
        >
          {TOOLS.map(({ href, label, icon, external }) => {
            const inner = (
              <>
                <span aria-hidden="true">{icon}</span>
                <span className="flex-1">{label}</span>
                {external && (
                  <span className="text-slate-400 dark:text-slate-500 text-xs" aria-hidden="true">
                    ↗
                  </span>
                )}
              </>
            );
            const cls =
              'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200';
            return external ? (
              <a
                key={label}
                role="menuitem"
                href={href}
                className={cls}
                onClick={() => setOpen(false)}
              >
                {inner}
              </a>
            ) : (
              <Link
                key={label}
                role="menuitem"
                href={href}
                className={cls}
                onClick={() => setOpen(false)}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 全站公共顶部导航。首页与「资料共享」独立页共用同一份导航，
// 避免两处各写一遍导致入口不一致。
export default function SiteHeader() {
  return (
    <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
          爱
        </div>
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
          爱讲题
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <ThemeToggle />
        <Button asChild size="sm" variant="outline">
          <Link href="/camp">🚀 AI 原生教育</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/csp-lecture">📚 信息学奥赛</Link>
        </Button>
        <ToolboxMenu />
      </div>
    </nav>
  );
}
