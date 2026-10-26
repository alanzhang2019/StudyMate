'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/app/components/ThemeToggle';

// 顶部导航：AI 自学平台 / AI 原生教育 / 百宝箱▾（+「开始自学」按钮）。
// 品牌层级（2026-10-26 定稿）：爱讲题 = 主品牌；后浪奔涌 = AI 自学平台子品牌；
// 少年 AI 创造营 = AI 原生教育产品名；百宝箱 = 工具集合入口。
// 信奥、深圳教材、云剪切板等零散工具统一收进「百宝箱」下拉。

type Tool = {
  href: string;
  label: string;
  icon: string;
  /** true ⇒ 用原生 `<a>` 整页走（跨应用或 public 下的静态 HTML，不吃 Next 客户端导航） */
  external: boolean;
  /** true ⇒ 真的离开本站（跨域），下拉里给个 ↗ 提示 */
  offSite?: boolean;
  /** hover 时显示的完整说明（下拉里放不下全称时用） */
  full?: string;
};

const TOOLS: Tool[] = [
  // ★ 拍照讲题是本站原生功能（/mistake，OpenCV 检测题目区域 + 语音输入），
  //   放百宝箱第一位。它和首页 Hero 的「AI 自学」（/ai/，hl-platform）是两套东西，
  //   别混：/mistake 讲一道题，/ai/ 是自学闭环。
  { href: '/mistake', label: '拍照讲题', icon: '📷', external: false, full: '作业不会做，拍一下马上讲明白 —— 不只给答案，一步一步讲清楚这题该怎么想' },
  { href: '/textbooks', label: '深圳教材', icon: '📖', external: false },
  // 2026-10-26：资料共享 → 云剪切板（用户定名）。
  { href: '/clipboard', label: '云剪切板', icon: '📋', external: false },
  // ★ 静态 HTML（在 public/ 下），不是 Next 路由 ⇒ 用 `<a>` 不用 `<Link>`。
  //   这份规约是可勾选、可填写、可打印签字的一整页文档，
  //   勾选与填写会存本机 localStorage（key: hl.familyAgreement.v1）。
  { href: '/family-agreement.html', label: '家庭设备规约', icon: '📜', external: true, offSite: false, full: '家庭电子产品使用规约 · 可在线勾选填写，再打印签字' },
  // ★ 静态 HTML（在 public/ 下），不是 Next 路由 ⇒ 用 `<a>` 不用 `<Link>`。
  //   复赛防爆零自查表：机试环境操作 10 项 + 代码防爆零 5 项 = 15 项逐项自查，
  //   提交即出爆零风险等级与整改建议，可打印保存。
  //   ★ 更新内容时必须同步这里的「N 项」与分部分描述（学生按标题判断要不要点开）。
  { href: '/contest-anti-zero-checklist.html', label: '复赛防爆零自查表', icon: '🛡️', external: true, offSite: false, full: 'CSP-J / CSP-S 复赛防爆零：机试环境操作（建目录、文件命名、读写、自测、交卷检查）+ 代码防爆零（多组数据清空、long long、边界数据、保存、清场），15 项逐项自查' },
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
        百宝箱
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden z-50"
        >
          {TOOLS.map(({ href, label, icon, external, offSite, full }) => {
            const inner = (
              <>
                <span aria-hidden="true">{icon}</span>
                <span className="flex-1">{label}</span>
                {offSite && (
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
                title={full}
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
                title={full}
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
        <img
          src="/assets/homepage/logo.png"
          alt="爱讲题 logo"
          className="h-9 w-auto"
        />
        <span className="text-lg font-bold text-[#0F1E3D] dark:text-slate-100">
          爱讲题
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <ThemeToggle />
        <Button asChild size="sm" variant="outline">
          <a href="/ai/">AI 自学平台</a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/camp">AI 原生教育</Link>
        </Button>
        <ToolboxMenu />
        <Button asChild size="sm" className="bg-[#2B5CFF] hover:bg-[#1f4ae0] text-white">
          <a href="/ai/">开始自学</a>
        </Button>
      </div>
    </nav>
  );
}
