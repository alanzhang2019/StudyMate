'use client';

/**
 * 关联教材选择器（可折叠 + 可搜索）
 *
 * 背景：89 册教材全量塞进原生 <select> 的下拉会撑出两三屏，孩子根本找不到。
 * 这个组件用「按钮 + 弹出面板」代替原生 select：
 *   - 顶部搜索框（按教材名 / 学科名过滤）；
 *   - 按学科折叠（<details>，搜索时自动全展开）；
 *   - 顶部固定「与教材无关（自由创作）」选项（allowNone），对应 value = ''。
 *
 * 视觉上复用 .submit-select 的描边/箭头语言（见 shared.css 的 .tbp-* 段）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { groupTextbooksBySubject, textbookTitle } from '@/lib/textbooks';

const GROUPS = groupTextbooksBySubject();

export default function TextbookPicker({
  value,
  onChange,
  allowNone = true,
  placeholder = '请选择关联教材',
}: {
  value: string;
  onChange: (slug: string) => void;
  /** 是否提供「与教材无关（自由创作）」选项（value=''） */
  allowNone?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // 点外面 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      books: g.books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) || g.label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.books.length > 0);
  }, [q]);

  const label = value ? textbookTitle(value) : '';

  const pick = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="tbp" ref={rootRef}>
      <button
        type="button"
        className={`submit-select tbp-trigger${value ? '' : ' tbp-trigger--empty'}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="tbp-trigger-label">{label || placeholder}</span>
      </button>

      {open ? (
        <div className="tbp-panel" role="listbox">
          <input
            className="tbp-search"
            autoFocus
            placeholder="搜索教材或学科，如：数学 / 三年级"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="tbp-list">
            {allowNone ? (
              <button
                type="button"
                className={`tbp-option tbp-option--none${!value ? ' tbp-option--active' : ''}`}
                onClick={() => pick('')}
              >
                🎨 与教材无关（自由创作）
              </button>
            ) : null}
            {filtered.map((g) => (
              <details key={g.subject} className="tbp-group" open={!!q}>
                <summary className="tbp-group-label">
                  <span>{g.label}</span>
                  <span className="tbp-count">{g.books.length}</span>
                </summary>
                {g.books.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    className={`tbp-option${value === b.slug ? ' tbp-option--active' : ''}`}
                    onClick={() => pick(b.slug)}
                  >
                    {b.title}
                  </button>
                ))}
              </details>
            ))}
            {filtered.length === 0 ? (
              <p className="tbp-empty">没有匹配的教材，可选「与教材无关」</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
