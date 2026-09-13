'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORY_OPTIONS = [
  { value: '作品', label: '作品' },
  { value: '项目', label: '项目' },
  { value: '代码', label: '代码' },
  { value: '其他', label: '其他' },
];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; id: string | null }
  | { kind: 'error'; message: string };

export default function CampSubmitPage() {
  const [title, setTitle] = useState('');
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [category, setCategory] = useState('作品');
  const [coverImage, setCoverImage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [company, setCompany] = useState(''); // 蜜罐，隐藏，留空

  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const canSubmit =
    title.trim().length > 0 &&
    studentName.trim().length > 0 &&
    state.kind !== 'submitting';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/camp/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          studentName: studentName.trim(),
          className: className.trim(),
          category,
          coverImage: coverImage.trim(),
          linkUrl: linkUrl.trim(),
          description: description.trim(),
          techStack: techStack.trim(),
          company,
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.success) {
        if (res.status === 429) {
          setState({ kind: 'error', message: '提交太频繁，请稍后再试' });
        } else {
          setState({
            kind: 'error',
            message: json.error || `提交失败（HTTP ${res.status}）`,
          });
        }
        return;
      }
      setState({ kind: 'success', id: json.data?.id ?? null });
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message || '网络错误，请重试' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <header className="border-b border-amber-100 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 h-16 flex items-center justify-between">
          <Link href="/camp" className="flex items-center gap-2">
            <img
              src="/assets/alan-avatar.png"
              alt=""
              className="w-8 h-8 rounded-full"
            />
            <span className="font-semibold text-gray-800">Alan张老师 · 少年 AI 创造营</span>
          </Link>
          <Link
            href="/camp/works"
            className="text-sm text-amber-700 hover:text-amber-800"
          >
            看作品墙 →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {state.kind === 'success' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">提交成功！</h1>
            <p className="text-gray-600 mb-1">
              你的作品已经进入老师的审核队列。
            </p>
            <p className="text-gray-500 text-sm mb-6">
              审核通过后，作品会自动出现在公开作品墙
              <span className="text-amber-700"> /camp/works</span> 上。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/camp/works"
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                去作品墙看看
              </Link>
              <button
                onClick={() => {
                  setTitle('');
                  setStudentName('');
                  setClassName('');
                  setCategory('作品');
                  setCoverImage('');
                  setLinkUrl('');
                  setDescription('');
                  setTechStack('');
                  setState({ kind: 'idle' });
                }}
                className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                再传一个
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="text-amber-700 font-mono text-xs tracking-widest uppercase mb-2">
                Submit your work
              </p>
              <h1 className="text-3xl font-bold text-gray-900">
                上传我的作品
              </h1>
              <p className="text-gray-500 mt-2 text-sm">
                填好下面的信息，提交后老师审核通过就会出现在作品墙啦。
              </p>
            </div>

            {state.kind === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {state.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="作品标题" required>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="例如：动物迷宫大乱斗"
                  className={inputCls}
                />
              </Field>
              <Field label="你的名字" required>
                <input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  maxLength={40}
                  placeholder="例如：炳炳"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="班级（选填）">
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  maxLength={40}
                  placeholder="例如：AI创造营1班"
                  className={inputCls}
                />
              </Field>
              <Field label="作品类型">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="封面图链接（选填）" hint="http(s) 开头的图片地址">
              <input
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </Field>

            <Field label="作品链接（选填）" hint="例如 Scratch / 可运行demo 的网址">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </Field>

            <Field label="作品介绍（选填）" hint="讲讲你做了什么、怎么想的">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="我在作品里实现了……最有趣的部分是……"
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field label="用到的小技能（选填）" hint="用空格或逗号分隔，例如：Trae WorkBuddy 动画">
              <input
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="Trae WorkBuddy"
                className={inputCls}
              />
            </Field>

            {/* 蜜罐：真实用户看不见、不填；机器人若填了会被静默丢弃 */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>
                公司（请勿填写）
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition"
              >
                {state.kind === 'submitting' ? '提交中…' : '提交作品'}
              </button>
              <Link
                href="/camp/works"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                取消
              </Link>
            </div>

            <p className="text-xs text-gray-400">
              提交即表示同意老师将本作品在「少年 AI 创造营」作品墙公开展示。
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 ' +
  'bg-white placeholder:text-gray-400';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
