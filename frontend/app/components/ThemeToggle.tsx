'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

type Theme = 'light' | 'dark' | 'system';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
  { value: 'system', label: '跟随系统', Icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const Current = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
        title="切换主题"
        aria-label="切换主题"
      >
        <Current className="w-4 h-4" />
        <span className="hidden sm:inline">
          {theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden z-50">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 ${
                theme === value
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                  : ''
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
