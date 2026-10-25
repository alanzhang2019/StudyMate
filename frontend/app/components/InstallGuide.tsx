'use client';

import { useEffect, useState } from 'react';

/**
 * 「把云端版装进手机桌面」导引。
 *
 * ## 为什么要它
 * 爱讲题是**云端版**（HTTPS + 浏览器打开），学生每次用都要先开浏览器、输网址。
 * 装到手机桌面后才是「一个 App」的样子：全屏、没有地址栏、一点就进课堂。
 * 这个价值学生不会自己知道，所以必须在首页把步骤写清楚。
 *
 * ## 平台差异（两个 Tab 的由来）
 * - iPhone / iPad：**只有 Safari** 能「添加到主屏幕」；Chrome on iOS 没有这个入口。
 *   路径 = Safari 底部「分享」→ 下滑找到「添加到主屏幕」。
 * - 安卓：Chrome ⋮ 菜单里是「安装应用」（站点带 manifest 且满足条件时），
 *   部分国产浏览器叫「添加到主屏幕」。两者都写了，避免用户在别的浏览器里找不到。
 *
 * ## 交互细节
 * - 首次渲染固定 iOS（SSR 与 client 一致，避免 hydration mismatch），
 *   挂载后再按 UA 切到安卓 —— 切换发生在 hydration 之后，不会报错。
 * - `InstallGuideView` 是纯展示（tab 由外部给），本地静态预览与截图都靠它；
 *   `InstallGuide` 才是带状态的外壳。
 */

type TabKey = 'ios' | 'android';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ios', label: 'iPhone / iPad' },
  { key: 'android', label: '安卓手机' },
];

type Chip =
  | { kind: 'text'; text: string; mono?: boolean; href?: string }
  | { kind: 'icon'; icon: React.ReactNode };

type Step = { text: string; chip: Chip };

const URL_TEXT = 'aijiangti.cn';

const GUIDES: Record<TabKey, Step[]> = {
  ios: [
    {
      text: '用 Safari 打开',
      chip: { kind: 'text', text: URL_TEXT, mono: true, href: 'https://aijiangti.cn' },
    },
    {
      text: '点底部的分享按钮',
      chip: {
        kind: 'icon',
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3.2v11.2" />
            <path d="M8.4 6.8 12 3.2l3.6 3.6" />
            <path d="M7.2 10.4H5.6A1.6 1.6 0 0 0 4 12v7.4A1.6 1.6 0 0 0 5.6 21h12.8a1.6 1.6 0 0 0 1.6-1.6V12a1.6 1.6 0 0 0-1.6-1.6h-1.6" />
          </svg>
        ),
      },
    },
    {
      text: '选择',
      chip: {
        kind: 'icon',
        icon: (
          <span className="inline-flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4" />
              <path d="M12 8.6v6.8M8.6 12h6.8" />
            </svg>
            <span>添加到主屏幕</span>
          </span>
        ),
      },
    },
  ],
  android: [
    {
      text: '用 Chrome 或系统浏览器打开',
      chip: { kind: 'text', text: URL_TEXT, mono: true, href: 'https://aijiangti.cn' },
    },
    {
      text: '点浏览器菜单',
      chip: {
        kind: 'icon',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        ),
      },
    },
    {
      text: '选择',
      chip: { kind: 'text', text: '添加到主屏幕 / 安装应用' },
    },
  ],
};

function ChipView({ chip }: { chip: Chip }) {
  if (chip.kind === 'icon') {
    return (
      <span className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-2.5 py-1 text-[13px] text-slate-700 dark:text-slate-200 shadow-sm">
        {chip.icon}
      </span>
    );
  }
  const cls =
    'inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-2.5 py-1 text-[13px] text-slate-800 dark:text-slate-100 shadow-sm hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors';
  if (chip.href) {
    return (
      <a href={chip.href} className={cls + (chip.mono ? ' font-mono' : '')}>
        {chip.text}
      </a>
    );
  }
  return <span className={cls + (chip.mono ? ' font-mono' : '')}>{chip.text}</span>;
}

export function InstallGuideView({
  tab,
  onSelect,
}: {
  tab: TabKey;
  onSelect?: (t: TabKey) => void;
}) {
  const steps = GUIDES[tab];

  return (
    <section id="install" className="max-w-3xl mx-auto px-6 pb-20 scroll-mt-20">
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 text-center transition-colors">
        把云端版装进手机桌面
      </h2>

      <div className="mt-8 flex flex-col items-center">
        <div className="h-24 w-24 overflow-hidden rounded-[22px] bg-white dark:bg-slate-800 shadow-[0_12px_32px_rgba(30,41,59,0.20)] ring-1 ring-slate-900/5 dark:ring-white/10">
          {/* 站点自己的图标（public/logo.svg），保证「装出来的东西」和「图标」是同一个 */}
          <img src="/logo.svg" alt="爱讲题" width={96} height={96} className="h-full w-full" />
        </div>
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">爱讲题</div>
      </div>

      <p className="mt-6 text-center text-base sm:text-lg text-slate-600 dark:text-slate-300 transition-colors">
        装好后，它就像一个 App：全屏打开，一步进课堂。
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur shadow-sm dark:border-slate-700/70 dark:bg-slate-800/50 transition-colors">
        <div className="grid grid-cols-2 border-b border-slate-200/80 dark:border-slate-700/70">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={onSelect ? () => onSelect(t.key) : undefined}
                aria-pressed={active}
                className={
                  '-mb-px border-b-2 px-4 py-4 text-base transition-colors ' +
                  (active
                    ? 'border-slate-900 dark:border-slate-100 font-semibold text-slate-900 dark:text-slate-50'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <ol className="space-y-5 px-5 py-6 sm:px-8 sm:py-7">
          {steps.map((s, i) => (
            <li key={tab + i} className="flex items-start gap-3 text-slate-700 dark:text-slate-200">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 font-serif italic text-[13px] leading-none text-slate-500 dark:text-slate-400"
              >
                {i + 1}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base sm:text-[17px] leading-relaxed">
                <span>{s.text}</span>
                <ChipView chip={s.chip} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function InstallGuide() {
  const [tab, setTab] = useState<TabKey>('ios');

  // 挂载后再按 UA 预选：SSR 阶段必须与首帧一致，否则 hydration 会报 mismatch。
  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) setTab('android');
  }, []);

  return <InstallGuideView tab={tab} onSelect={setTab} />;
}
