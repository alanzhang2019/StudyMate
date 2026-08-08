'use client';

// components/csp-lecture/lecture-group.tsx
//
// 一个可折叠的课件分组容器。 之前的版本在 /csp-lecture
// 页面里把 "CSP要点精讲" 和 "历年真题" 两块内容都默认
// 展开, 16 个精讲章节 + 2 套真题卷直接顶满首屏, 让 hero
// 区域和 OI 横幅都得往下拖才能看见。
//
// 改造后:
//   - 默认折叠 (collapsed): 只显示分类标题 + 副标 + 数量
//     提示 + 右侧 ChevronDown 图标
//   - 点击 header 整行可展开/折叠
//   - 用 motion.div 给 children 做 height 动画, 避免
//     直接 display:none 显得突兀
//   - 用一个 sticky 的 button 区 header, 键盘可达 (a11y)

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle: string;
  /** Tailwind classes for the gradient strip + outer border. */
  accentClass: string;
  /** Tailwind classes for the small title chip. */
  badgeClass: string;
  /**
   * Number of items in the group. Displayed in the header
   * (e.g. "1 个课件" / "2 套真题"). Lets the student
   * decide whether to expand without committing to the
   * click.
   */
  count: number;
  /** Unit label after `count`, e.g. "个课件" / "套真题". */
  countLabel: string;
  /**
   * Whether the group should render expanded by default. We
   * only use this for the empty state, so most call sites
   * don't pass it.
   */
  defaultOpen?: boolean;
  children: ReactNode;
};

export function LectureGroup({
  title,
  subtitle,
  accentClass,
  badgeClass,
  count,
  countLabel,
  defaultOpen = false,
  children,
}: Props) {
  // The page is a server component but this widget needs
  // useState; that's why it lives in its own client file.
  // We default to `defaultOpen` (false) so the first paint
  // shows the page with both groups collapsed — exactly
  // what the user asked for to declutter the page.
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn(
        'relative rounded-2xl border bg-white/40 backdrop-blur p-5 sm:p-6',
        accentClass,
      )}
    >
      {/* Decorative gradient strip at the very top — gives the
          group a clear "this is its own thing" visual. */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r',
          accentClass,
        )}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left mb-5 group focus:outline-none
                   focus-visible:ring-2 focus-visible:ring-violet-400
                   focus-visible:ring-offset-2 rounded-md -m-1 p-1"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  badgeClass,
                )}
              >
                {title}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/70 rounded-full px-2 py-0.5 border border-slate-200/70">
                {count} {countLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            <p
              className={cn(
                'mt-1.5 text-[11px] font-medium transition-colors',
                open ? 'text-slate-400' : 'text-violet-600 group-hover:text-violet-700',
              )}
            >
              {open ? '点击收起 ↑' : '点击展开 ↓'}
            </p>
          </div>
          <ChevronDown
            className={cn(
              'w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200',
              open && 'rotate-180 text-violet-500',
            )}
            aria-hidden="true"
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
