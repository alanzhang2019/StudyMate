'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const GRADE_OPTIONS = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '不便透露',
];

const CATEGORY_OPTIONS = [
  { value: '作品', label: '作品' },
  { value: '项目', label: '项目' },
  { value: '代码', label: '代码' },
  { value: '其他', label: '其他' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

type Banner = { kind: 'ok' | 'error'; text: string } | null;

export default function CampWorkEditPage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [studentName, setStudentName] = useState('');
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('不便透露');
  const [className, setClassName] = useState('');
  const [category, setCategory] = useState('作品');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverSource, setCoverSource] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [hasHtml, setHasHtml] = useState(false);

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'' | 'cover' | 'description'>('');
  const [banner, setBanner] = useState<Banner>(null);

  useEffect(() => {
    if (!token) {
      setLoad({ kind: 'error', message: '链接无效' });
      return;
    }
    fetch(`/api/camp/works/edit/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setLoad({ kind: 'error', message: json.error || '加载失败' });
          return;
        }
        const d = json.data;
        setStudentName(d.studentName || '');
        setTitle(d.title || '');
        setGrade(d.grade || '不便透露');
        setClassName(d.className || '');
        setCategory(d.category || '作品');
        setDescription(d.description || '');
        setCoverImage(d.coverImage || '');
        setCoverSource(d.coverSource || '');
        setHasHtml(!!d.hasHtml);
        setLoad({ kind: 'ready' });
      })
      .catch(() => setLoad({ kind: 'error', message: '网络错误，请重试' }));
  }, [token]);

  const handleSave = async () => {
    if (!title.trim()) {
      setBanner({ kind: 'error', text: '请填写作品标题' });
      return;
    }
    setSaving(true);
    setBanner(null);
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('grade', grade);
    fd.append('className', className.trim());
    fd.append('category', category);
    if (coverFile) fd.append('coverFile', coverFile);
    if (htmlFile) fd.append('htmlFile', htmlFile);
    try {
      const res = await fetch(`/api/camp/works/edit/${token}`, { method: 'PATCH', body: fd });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.success) {
        setBanner({ kind: 'error', text: json.error || `保存失败（HTTP ${res.status}）` });
        return;
      }
      const d = json.data || {};
      if (d.coverImage) setCoverImage(d.coverImage);
      if (d.coverSource) setCoverSource(d.coverSource);
      setCoverFile(null);
      setHtmlFile(null);
      setBanner({ kind: 'ok', text: '已保存，作品会重新交给老师审核' });
    } catch (e: any) {
      setBanner({ kind: 'error', text: e?.message || '网络错误' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (kind: 'cover' | 'description') => {
    setBusy(kind);
    setBanner(null);
    try {
      const res = await fetch(`/api/camp/works/edit/${token}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.success) {
        setBanner({ kind: 'error', text: json.error || '生成失败，请稍后重试' });
        return;
      }
      if (kind === 'cover') {
        setCoverImage(json.data?.coverImage || '');
        setCoverSource(json.data?.coverSource || 'ai');
        setBanner({ kind: 'ok', text: '封面已重新生成' });
      } else {
        setDescription(json.data?.description || description);
        setBanner({ kind: 'ok', text: '介绍已重新生成' });
      }
    } catch (e: any) {
      setBanner({ kind: 'error', text: e?.message || '网络错误' });
    } finally {
      setBusy('');
    }
  };

  if (load.kind === 'loading') {
    return (
      <div className="works-page">
        <div className="submit-shell">
          <p className="submit-card-intro">加载中…</p>
        </div>
      </div>
    );
  }

  if (load.kind === 'error') {
    return (
      <div className="works-page">
        <header className="works-header">
          <Link href="/camp" className="works-brand" aria-label="返回Alan张老师首页">
            <span className="brand-identity">
              <img className="brand-identity-mark" src="/assets/alan-avatar.png" alt="" />
              <img className="brand-identity-wordmark" src="/assets/alan-logo.svg" alt="Alan张老师" />
            </span>
          </Link>
          <nav className="works-header-actions">
            <Link href="/camp/works" className="page-switch-link">看作品墙 →</Link>
          </nav>
        </header>
        <section className="submit-shell">
          <div className="submit-success">
            <span className="work-note-tape" aria-hidden="true" />
            <h2>链接无效</h2>
            <p>{load.message}</p>
            <div className="submit-success-actions">
              <Link href="/camp" className="submit-button-primary">回到首页</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="works-page">
      <header className="works-header">
        <Link href="/camp" className="works-brand" aria-label="返回Alan张老师首页">
          <span className="brand-identity">
            <img className="brand-identity-mark" src="/assets/alan-avatar.png" alt="" />
            <img className="brand-identity-wordmark" src="/assets/alan-logo.svg" alt="Alan张老师" />
          </span>
        </Link>
        <nav className="works-header-actions" aria-label="编辑页导航">
          <Link href="/camp/works" className="page-switch-link">看作品墙 →</Link>
        </nav>
      </header>

      <section className="submit-intro">
        <p className="mono submit-kicker">EDIT YOUR WORK / 04</p>
        <h1>
          改一改
          <br />
          <span>你的作品。</span>
        </h1>
        <p>
          {studentName ? `嗨，${studentName}！` : '嗨！'}
          下面这些都能改——改完点「保存」，作品会重新交给老师审核。
        </p>
      </section>

      <section className="submit-shell">
        <form
          className="submit-card"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          noValidate
        >
          <span className="work-note-tape" aria-hidden="true" />

          {/* 封面预览 + 重新生成 / 上传 */}
          <div className="edit-cover-block">
            <div className="edit-cover-preview">
              {coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImage} alt="作品封面预览" />
              ) : (
                <div className="edit-cover-empty">暂无封面</div>
              )}
            </div>
            <div className="edit-cover-actions">
              <button
                type="button"
                className="submit-button-secondary"
                disabled={busy !== ''}
                onClick={() => handleRegenerate('cover')}
              >
                {busy === 'cover' ? '生成中…' : '重新生成 AI 封面'}
              </button>
              <label className="submit-file submit-file--inline">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="submit-file-input"
                />
                <span className="submit-file-label">
                  {coverFile ? coverFile.name : '上传自己的封面'}
                </span>
              </label>
            </div>
            <p className="submit-field-hint">
              当前封面：{coverSource === 'ai' ? 'AI 生成' : coverSource === 'upload' ? '已上传' : coverSource === 'url' ? '外链' : '暂无'}
            </p>
          </div>

          {banner ? (
            <div className={`edit-banner ${banner.kind === 'ok' ? 'edit-banner--ok' : 'edit-banner--error'}`}>
              {banner.text}
            </div>
          ) : null}

          <div className="submit-divider" aria-hidden="true" />

          <div className="submit-card-head">
            <p className="mono submit-kicker">作品信息</p>
          </div>

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
            <Field label="类型">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="submit-select">
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="年级">
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className="submit-select">
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="班级" hint="选填">
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                maxLength={40}
                className="submit-input"
              />
            </Field>
          </div>

          <Field label="作品介绍" hint="可点下方按钮让 AI 重写">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder="讲讲你做了什么、最有趣的地方是……"
              className="submit-textarea"
            />
          </Field>
          <button
            type="button"
            className="submit-button-secondary"
            disabled={busy !== ''}
            onClick={() => handleRegenerate('description')}
          >
            {busy === 'description' ? '生成中…' : 'AI 重新写介绍'}
          </button>

          <div className="submit-divider" aria-hidden="true" />

          <Field label="作品文件（HTML）" hint={hasHtml ? '已上传，可替换' : '选填'}>
            <label className="submit-file">
              <input
                type="file"
                accept=".html,.htm,text/html"
                onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
                className="submit-file-input"
              />
              <span className="submit-file-label">
                {htmlFile ? htmlFile.name : hasHtml ? '替换 .html 文件' : '上传 .html 文件'}
              </span>
            </label>
          </Field>

          <div className="submit-actions">
            <button type="submit" disabled={saving} className="submit-button-primary">
              {saving ? '保存中…' : '保存修改 →'}
            </button>
            <Link href="/camp/works" className="submit-button-secondary">取消</Link>
          </div>

          <p className="submit-fineprint">
            保存后作品会重新进入审核队列，老师审核通过后才会重新上墙。
          </p>
        </form>
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
