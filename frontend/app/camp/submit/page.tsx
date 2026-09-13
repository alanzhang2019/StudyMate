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
  | { kind: 'generating' }
  | { kind: 'submitting' }
  | {
      kind: 'success';
      id: string | null;
      editUrl?: string;
      description?: string;
      coverImage?: string;
      coverSource?: string;
    }
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
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [company, setCompany] = useState(''); // 蜜罐，隐藏，留空

  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const busy = state.kind === 'generating' || state.kind === 'submitting';

  const canSubmit =
    title.trim().length > 0 && studentName.trim().length > 0 && !busy;

  const buildFormData = (file?: File): FormData => {
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('studentName', studentName.trim());
    fd.append('grade', grade);
    fd.append('className', className.trim());
    fd.append('category', category);
    fd.append('coverImage', coverImage.trim());
    fd.append('linkUrl', linkUrl.trim());
    fd.append('description', description.trim());
    fd.append('techStack', techStack.trim());
    fd.append('company', company);
    if (file) fd.append('htmlFile', file);
    return fd;
  };

  const doSubmit = async (file?: File) => {
    setState(file ? { kind: 'generating' } : { kind: 'submitting' });
    try {
      const res = await fetch('/api/camp/works', {
        method: 'POST',
        body: buildFormData(file),
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
      setState({
        kind: 'success',
        id: json.data?.id ?? null,
        editUrl: json.data?.editUrl,
        description: json.data?.description,
        coverImage: json.data?.coverImage,
        coverSource: json.data?.coverSource,
      });
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message || '网络错误，请重试' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    doSubmit(htmlFile ?? undefined);
  };

  // 上传 HTML：立即触发「创建 + 自动生成」，无需再点提交
  const handleHtmlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setHtmlFile(file);
    if (!/\.html?$/i.test(file.name)) {
      setState({ kind: 'error', message: '作品文件请用 .html 格式' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState({ kind: 'error', message: 'HTML 文件不能超过 5MB' });
      return;
    }
    if (!title.trim() || !studentName.trim()) {
      setState({
        kind: 'error',
        message: '请先填写「作品标题」和「你的名字」，再上传 HTML 作品',
      });
      return;
    }
    await doSubmit(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] ?? null;
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setState({ kind: 'error', message: '只支持 .html 格式的作品文件' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState({ kind: 'error', message: 'HTML 文件不能超过 5MB' });
      return;
    }
    setHtmlFile(file);
    if (!title.trim() || !studentName.trim()) {
      setState({
        kind: 'error',
        message: '请先填写「作品标题」和「你的名字」，再上传 HTML 作品',
      });
      return;
    }
    void doSubmit(file);
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
    setHtmlFile(null);
    setDragOver(false);
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
          上传一个 HTML 作品，我们会自动帮你写介绍、生成封面；
          也可以只填文字。老师审核通过后，作品就会出现在「作品墙」上。
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

            {state.coverImage ? (
              <div className="submit-success-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.coverImage} alt={title || '作品封面'} />
                <p className="submit-success-cover-note">
                  {state.coverSource === 'screenshot'
                    ? '封面已用你的作品真实截图生成'
                    : state.coverSource === 'ai'
                    ? '封面已用 AI 插画生成'
                    : '封面已生成'}
                </p>
              </div>
            ) : null}

            {state.description ? (
              <div className="submit-success-desc">
                <p className="mono submit-kicker">自动生成的介绍</p>
                <p className="submit-success-desc-body">{state.description}</p>
              </div>
            ) : null}

            <p>
              你的作品已经进入老师的审核队列。
              <br />
              审核通过后，会自动出现在
              <span className="submit-success-link"> /camp/works</span>
              。
            </p>

            {state.editUrl ? (
              <div className="submit-success-edit">
                <p className="mono submit-kicker">改一改？</p>
                <p>
                  想自己调整介绍、换封面？点下面进去就行——
                  <strong>记得收藏地址栏的链接</strong>，随时回来改。
                </p>
                <Link href={state.editUrl} className="submit-button-secondary">
                  去修改介绍和封面 →
                </Link>
              </div>
            ) : null}

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
                上传 HTML 作品后，我们会当场帮你写介绍、生成封面，你什么都不用再点。
              </p>
            </div>

            <Field
              label="作品文件（HTML）"
              hint="上传后自动生成介绍和封面，无需再点提交"
            >
              <label
                className={`upload-zone ${dragOver ? 'upload-zone--over' : ''} ${
                  state.kind === 'generating' ? 'upload-zone--busy' : ''
                } ${htmlFile ? 'upload-zone--has-file' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={handleHtmlChange}
                  disabled={busy}
                  className="submit-file-input"
                />
                <span className="upload-zone-icon" aria-hidden="true">
                  {state.kind === 'generating' ? '⏳' : '📄'}
                </span>
                <span className="upload-zone-title">
                  {state.kind === 'generating'
                    ? '正在读你的作品，自动写介绍和封面…'
                    : htmlFile
                    ? `已选：${htmlFile.name}`
                    : '点击或拖拽 .html 文件到这里'}
                </span>
                <span className="upload-zone-hint">
                  {state.kind === 'generating'
                    ? '生成可能要等 10-30 秒，请稍候'
                    : '上传后无需再点提交，介绍和封面会自动填好'}
                </span>
              </label>
            </Field>

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

            <Field label="封面图链接" hint="选填 · 不传 HTML 时可填 http(s) 图片地址">
              <input
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="submit-input"
              />
            </Field>

            <Field label="作品链接" hint="选填 · 例如 Scratch / 可运行 demo 的网址">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="submit-input"
              />
            </Field>

            <Field label="作品介绍" hint="选填 · 上传 HTML 会自动帮你写">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="我在作品里实现了……最有趣的部分是……"
                className="submit-textarea"
              />
            </Field>

            <Field label="用到的小技能" hint="选填 · 用空格或逗号分隔">
              <input
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="Trae · WorkBuddy"
                className="submit-input"
              />
            </Field>

            {/* 蜜罐：真实用户看不见、不填；机器人若填了会被静端丢弃。 */}
            <div aria-hidden="true" className="submit-honeypot">
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
              提交即表示同意老师将本作品在「AI 原生教育」作品墙公开展示。
            </p>
          </form>
        )}
      </section>

      <footer className="works-footer">
        <div className="works-footer-meta">
          <span>Alan张老师 · AI 原生教育</span>
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
