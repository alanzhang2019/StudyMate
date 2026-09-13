'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORY_OPTIONS = [
  { value: '作品', label: '作品' },
  { value: '项目', label: '项目' },
  { value: '代码', label: '代码' },
  { value: '其他', label: '其他' },
];

const GRADE_OPTIONS = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '不便透露',
];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; id: string | null }
  | { kind: 'error'; message: string };

export default function CampSubmitPage() {
  const [title, setTitle] = useState('');
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('不便透露');
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
          grade,
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

  const resetForm = () => {
    setTitle('');
    setStudentName('');
    setGrade('不便透露');
    setClassName('');
    setCategory('作品');
    setCoverImage('');
    setLinkUrl('');
    setDescription('');
    setTechStack('');
    setState({ kind: 'idle' });
  };

  return (
    <div className="works-page">
      <header className="works-header">
        <Link href="/camp" className="works-brand" aria-label="返回Alan张老师首页">
          <span className="brand-identity">
            <img
              className="brand-identity-mark"
              src="/assets/alan-avatar.png"
              alt=""
            />
            <img
              className="brand-identity-wordmark"
              src="/assets/alan-logo.svg"
              alt="Alan张老师"
            />
          </span>
        </Link>
        <nav className="works-header-actions" aria-label="提交页导航">
          <Link href="/camp/works" className="page-switch-link">
            看作品墙 →
          </Link>
        </nav>
      </header>

      <section className="submit-intro">
        <p className="mono submit-kicker">SUBMIT YOUR WORK / 03</p>
        <h1>
          把作品
          <br />
          <span>贴到这里。</span>
        </h1>
        <p>
          填好下面的信息，老师审核通过后，你的作品就会出现在「作品墙」上，
          跟炳炳、小高他们的作品一起被看见。
        </p>
      </section>

      <section className="submit-shell">
        {state.kind === 'success' ? (
          <div className="submit-success">
            <span className="work-note-tape" aria-hidden="true" />
            <p className="mono submit-kicker submit-kicker--success">
              已收到 ✓
            </p>
            <h2>提交成功！</h2>
            <p>
              你的作品已经进入老师的审核队列。
              <br />
              审核通过后，会自动出现在
              <span className="submit-success-link"> /camp/works</span>
              。
            </p>
            <div className="submit-success-actions">
              <Link href="/camp/works" className="submit-button-primary">
                去作品墙看看
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="submit-button-secondary"
              >
                再传一个
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="submit-card" noValidate>
            <span className="work-note-tape" aria-hidden="true" />

            <div className="submit-card-head">
              <p className="mono submit-kicker">STEP 01 — 学生信息</p>
              <p className="submit-card-intro">
                先告诉我你是谁、几年级。这两个信息会跟作品一起展示在作品墙上。
              </p>
            </div>

            {state.kind === 'error' ? (
              <div className="submit-error">{state.message}</div>
            ) : null}

            <div className="submit-grid">
              <Field label="作品标题" required>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="例如：动物迷宫大乱斗"
                  className="submit-input"
                />
              </Field>
              <Field label="你的名字" required>
                <input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  maxLength={40}
                  placeholder="例如：炳炳"
                  className="submit-input"
                />
              </Field>
              <Field label="年级" hint="不写也行">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="submit-select"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="班级" hint="选填">
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  maxLength={40}
                  placeholder="例如：AI 创造营 1 班"
                  className="submit-input"
                />
              </Field>
            </div>

            <div className="submit-divider" aria-hidden="true" />

            <div className="submit-card-head">
              <p className="mono submit-kicker">STEP 02 — 作品信息</p>
              <p className="submit-card-intro">
                介绍一下作品。链接和介绍留空也没关系，提交后可以再回来改。
              </p>
            </div>

            <Field label="作品类型">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="submit-select"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="封面图链接"
              hint="选填 · http(s) 开头的图片地址"
            >
              <input
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="submit-input"
              />
            </Field>

            <Field
              label="作品链接"
              hint="选填 · 例如 Scratch / 可运行 demo 的网址"
            >
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="submit-input"
              />
            </Field>

            <Field
              label="作品介绍"
              hint="选填 · 讲讲你做了什么、怎么想的"
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="我在作品里实现了……最有趣的部分是……"
                className="submit-textarea"
              />
            </Field>

            <Field
              label="用到的小技能"
              hint="选填 · 用空格或逗号分隔"
            >
              <input
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="Trae · WorkBuddy"
                className="submit-input"
              />
            </Field>

            {/* 蜜罐：真实用户看不见、不填；机器人若填了会被静端丢弃。 */}
            <div
              aria-hidden="true"
              className="submit-honeypot"
            >
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

            <div className="submit-actions">
              <button
                type="submit"
                disabled={!canSubmit}
                className="submit-button-primary"
              >
                {state.kind === 'submitting' ? '提交中…' : '提交作品 →'}
              </button>
              <Link href="/camp/works" className="submit-button-secondary">
                取消
              </Link>
            </div>

            <p className="submit-fineprint">
              提交即表示同意老师将本作品在「少年 AI 创造营」作品墙公开展示。
            </p>
          </form>
        )}
      </section>

      <footer className="works-footer">
        <div className="works-footer-meta">
          <span>Alan张老师 · 少年 AI 创造营</span>
        </div>
      </footer>
    </div>
  );
}

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
    <label className="submit-field">
      <div className="submit-field-label">
        <span>
          {label}
          {required ? <span className="submit-field-req">*</span> : null}
        </span>
        {hint ? <span className="submit-field-hint">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}