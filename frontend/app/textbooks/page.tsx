'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GRADE_CN,
  SUBJECT_LABEL,
  SUBJECT_NOTE,
  SUBJECT_ORDER,
  TEXTBOOKS,
  formatSize,
  type SubjectKey,
  type Textbook,
} from '../../lib/textbooks';

/** 每个科目的主题色（tab / 卡片角标） */
const SUBJECT_COLOR: Record<SubjectKey, string> = {
  chinese: '#e05d3d',
  math: '#2f6bff',
  english: '#0aa574',
  science: '#7a3ff2',
  physics: '#0a7ea4',
  chemistry: '#d97706',
  biology: '#16a34a',
  history: '#b45309',
  geography: '#0891b2',
  ethics: '#dc2626',
};

/** 超过该体积提示「建议下载后阅读」 */
const BIG_SIZE = 40 * 1024 * 1024;

type GradeFilter = 'all' | number;

export default function TextbooksPage() {
  const [subject, setSubject] = useState<SubjectKey | 'all'>('all');
  const [grade, setGrade] = useState<GradeFilter>('all');
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState<Textbook | null>(null);
  // iOS Safari 的 iframe 不渲染 PDF，直接走新标签打开
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  // Esc 关闭阅读器
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReading(null);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [reading]);

  const grades = useMemo(() => {
    const pool = subject === 'all' ? TEXTBOOKS : TEXTBOOKS.filter((b) => b.subject === subject);
    return [...new Set(pool.map((b) => b.grade))].sort((a, b) => a - b);
  }, [subject]);

  const counts = useMemo(() => {
    const m = new Map<SubjectKey | 'all', number>();
    m.set('all', TEXTBOOKS.length);
    for (const s of SUBJECT_ORDER) {
      m.set(s, TEXTBOOKS.filter((b) => b.subject === s).length);
    }
    return m;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEXTBOOKS.filter((b) => {
      if (subject !== 'all' && b.subject !== subject) return false;
      if (grade !== 'all' && b.grade !== grade) return false;
      if (q) {
        const hay = `${b.title} ${b.publisher} ${SUBJECT_LABEL[b.subject]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [subject, grade, query]);

  const pickSubject = (s: SubjectKey | 'all') => {
    setSubject(s);
    setGrade('all');
  };

  const openReader = (b: Textbook) => {
    if (isIOS) {
      window.open(`/textbooks/${b.slug}.pdf`, '_blank', 'noopener');
      return;
    }
    setReading(b);
  };

  const totalSize = useMemo(
    () => TEXTBOOKS.reduce((acc, b) => acc + b.sizeBytes, 0),
    []
  );

  return (
    <div className="min-h-screen bg-[#F3F6FC] text-slate-900">
      {/* 顶栏 */}
      <nav className="border-b border-[#D9E2F5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← 返回作业通
          </Link>
          <div className="text-sm text-slate-400">
            {TEXTBOOKS.length} 册 · {formatSize(totalSize)}
          </div>
        </div>
      </nav>

      {/* 头部：深圳校服蓝渐变 + 袖标白条纹 */}
      <header
        className="relative text-white"
        style={{ background: 'linear-gradient(100deg, #24418E 0%, #2B50A8 55%, #3A63C4 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#BFD4FF]">
            SHENZHEN TEXTBOOKS
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">深圳九年义务教育系列教材</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#D8E3FA]">
            覆盖 1-9 年级 · 10 科 89 册，按深圳在用版本收录：小学数学北师大版、小学英语沪教牛津版、
            小学科学教科版、初中地理湘教版，其余为人教/部编版。支持在线阅读与下载。
          </p>
        </div>
        {/* 校服袖标条纹（蓝白横条） */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2"
          style={{
            background:
              'repeating-linear-gradient(90deg, #ffffff 0 16px, transparent 16px 32px)',
          }}
        />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* 科目 tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => pickSubject('all')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              subject === 'all'
                ? 'bg-[#2B50A8] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-[#8FA9DE]'
            }`}
          >
            全部 <span className="opacity-60">{counts.get('all')}</span>
          </button>
          {SUBJECT_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => pickSubject(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                subject === s
                  ? 'text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-[#8FA9DE]'
              }`}
              style={subject === s ? { backgroundColor: SUBJECT_COLOR[s] } : undefined}
            >
              {SUBJECT_LABEL[s]} <span className="opacity-60">{counts.get(s)}</span>
            </button>
          ))}
        </div>

        {/* 年级 + 搜索 */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setGrade('all')}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                grade === 'all'
                  ? 'bg-[#2B50A8] text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-[#8FA9DE]'
              }`}
            >
              全部年级
            </button>
            {grades.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  grade === g
                    ? 'bg-[#2B50A8] text-white'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-[#8FA9DE]'
                }`}
              >
                {GRADE_CN[g]}年级
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索教材，如「一年级」「北师大」…"
            className="ml-auto w-56 rounded-lg border border-[#DCE5F6] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#2B50A8]"
          />
        </div>

        {/* 卡片网格 */}
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">没有匹配的教材，换个条件试试</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((b) => (
              <article
                key={b.slug}
                className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-[#DCE5F6] transition hover:shadow-[0_8px_24px_rgba(43,80,168,0.12)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: SUBJECT_COLOR[b.subject] }}
                  >
                    {SUBJECT_LABEL[b.subject]}
                  </span>
                  <span className="text-xs text-slate-400">{formatSize(b.sizeBytes)}</span>
                </div>
                <h2 className="mt-3 text-base font-semibold leading-snug">{b.title}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {b.publisher} · {b.semester}
                  {b.lite && ' · 轻量版'}
                </p>
                {b.sizeBytes > BIG_SIZE && !b.lite && (
                  <p className="mt-2 text-xs text-amber-600">文件较大，建议下载后阅读</p>
                )}
                <div className="mt-4 flex gap-2 pt-1">
                  <button
                    onClick={() => openReader(b)}
                    className="flex-1 rounded-lg bg-[#2B50A8] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1F3D8A]"
                  >
                    在线阅读
                  </button>
                  <a
                    href={`/textbooks/${b.slug}.pdf`}
                    download={`${b.title}.pdf`}
                    className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium text-slate-600 ring-1 ring-[#DCE5F6] transition hover:ring-[#8FA9DE]"
                  >
                    下载
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* 版本说明 */}
        <section className="mt-10 rounded-2xl bg-white p-6 ring-1 ring-[#DCE5F6]">
          <h3 className="text-sm font-semibold text-slate-900">版本说明（深圳在用）</h3>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs text-slate-500 sm:grid-cols-2">
            {SUBJECT_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: SUBJECT_COLOR[s] }}
                />
                <span className="font-medium text-slate-700">{SUBJECT_LABEL[s]}</span>
                <span>{SUBJECT_NOTE[s]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-[#E4EBF9] pt-3 text-xs leading-relaxed text-slate-400">
            教材版权归原出版机构所有，本模块仅供教学参考使用。官方电子教材可访问国家中小学智慧教育平台
            basic.smartedu.cn。
          </p>
        </section>
      </main>

      {/* 阅读器弹层（深藏蓝衬底，非纯黑） */}
      {reading && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#16295C]/95">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{reading.title}</p>
              <p className="text-xs text-[#B9C9EE]">
                {reading.publisher} · {formatSize(reading.sizeBytes)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/textbooks/${reading.slug}.pdf`}
                target="_blank"
                rel="noopener"
                className="rounded-lg px-3 py-1.5 text-xs text-[#D8E3FA] ring-1 ring-[#4A67B0] hover:bg-[#24418E]"
              >
                新标签打开
              </a>
              <button
                onClick={() => setReading(null)}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium hover:bg-white/20"
              >
                关闭
              </button>
            </div>
          </div>
          <iframe
            src={`/textbooks/${reading.slug}.pdf`}
            title={reading.title}
            className="w-full flex-1 bg-white"
          />
        </div>
      )}

      {/* 页脚 */}
      <footer className="border-t border-[#D9E2F5] py-8 text-center text-xs text-slate-400">
        深圳九年义务教育系列教材 · 作业通 aijiangti.cn
      </footer>
    </div>
  );
}
