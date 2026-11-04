'use client';

import { useState } from 'react';
import Link from 'next/link';
import { screenshotHtmlFile } from '@/lib/client/html-screenshot';
import { GRADE_OPTIONS } from '@/lib/camp/grades';
import {
  MEDIA_ACCEPT,
  MEDIA_LIMITS,
  MEDIA_KIND_LABEL,
  classifyMedia,
  formatMediaSize,
} from '@/lib/camp/media';
import TextbookPicker from '@/app/camp/textbook-picker';

const CATEGORY_OPTIONS = [
  { value: '作品', label: '作品' },
  { value: '项目', label: '项目' },
  { value: '代码', label: '代码' },
  { value: '其他', label: '其他' },
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
      mediaCount?: number;
      workKind?: string;
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
  const [textbook, setTextbook] = useState('');
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragMediaOver, setDragMediaOver] = useState(false);
  const [company, setCompany] = useState(''); // 蜜罐，隐藏，留空

  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const busy = state.kind === 'generating' || state.kind === 'submitting';

  // 教材可选：'' = 与教材无关（自由创作），也允许不选（未选时按无关处理）
  const canSubmit =
    title.trim().length > 0 && studentName.trim().length > 0 && !busy;

  const buildFormData = (
    file?: File,
    coverDataUrl?: string | null,
    extraMedia: File[] = [],
  ): FormData => {
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
    fd.append('textbook', textbook);
    fd.append('company', company);
    if (file) fd.append('htmlFile', file);
    // 同名多值字段：服务端 formData.entries() 会逐条收到（见 /api/camp/works POST）
    for (const f of extraMedia) fd.append('mediaFiles', f);
    if (coverDataUrl) fd.append('coverDataUrl', coverDataUrl);
    return fd;
  };

  const doSubmit = async (
    file?: File,
    coverDataUrl?: string | null,
    extraMedia: File[] = [],
  ) => {
    setState(file ? { kind: 'generating' } : { kind: 'submitting' });
    try {
      const res = await fetch('/api/camp/works', {
        method: 'POST',
        body: buildFormData(file, coverDataUrl, extraMedia),
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
        mediaCount: json.data?.mediaCount,
        workKind: json.data?.workKind,
      });
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message || '网络错误，请重试' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    doSubmit(htmlFile ?? undefined, undefined, mediaFiles);
  };

  // 上传 HTML：立即触发「客户端截图 + 自动生成介绍」，无需再点提交
  const captureAndSubmit = async (file: File) => {
    setHtmlFile(file);
    if (!title.trim() || !studentName.trim()) {
      setState({
        kind: 'error',
        message: '请先填写「作品标题」和「你的名字」，再上传 HTML 作品',
      });
      return;
    }

    // 客户端截图（html2canvas）—— 不依赖服务端 chromium / AI 配 key
    let coverDataUrl: string | null = null;
    try {
      setState({ kind: 'generating' });
      coverDataUrl = await screenshotHtmlFile(file);
    } catch (err: any) {
      console.warn('[submit] 客户端截图失败，继续走服务端兜底：', err);
      coverDataUrl = null;
    }

    await doSubmit(file, coverDataUrl, mediaFiles);
  };

  // 2026-11-04：非 HTML 作品素材（视频介绍 / 图片展示 / 文档附件）。
  // 前端先按与服务端同一份规则校验，给出即时反馈；服务端仍会独立复验。
  const validateAndAddMedia = (picked: File[]) => {
    if (!picked.length) return;
    const next = [...mediaFiles, ...picked];
    if (next.length > MEDIA_LIMITS.maxFiles) {
      setState({ kind: 'error', message: `作品素材最多 ${MEDIA_LIMITS.maxFiles} 个文件` });
      return;
    }
    const counts: Record<string, number> = { image: 0, video: 0, file: 0 };
    let total = 0;
    for (const f of next) {
      const cls = classifyMedia(f.name);
      if (!cls) {
        setState({
          kind: 'error',
          message: `「${f.name}」格式不支持，请选图片、视频、PDF、PPT、Word 或 ZIP`,
        });
        return;
      }
      if (f.size === 0) {
        setState({ kind: 'error', message: `「${f.name}」是空文件，请重新选择` });
        return;
      }
      if (f.size > cls.rule.max) {
        setState({
          kind: 'error',
          message: `「${f.name}」超过 ${Math.round(cls.rule.max / 1024 / 1024)}MB 上限`,
        });
        return;
      }
      counts[cls.rule.kind] += 1;
      const cap =
        cls.rule.kind === 'image'
          ? MEDIA_LIMITS.maxImage
          : cls.rule.kind === 'video'
          ? MEDIA_LIMITS.maxVideo
          : MEDIA_LIMITS.maxFile;
      if (counts[cls.rule.kind] > cap) {
        setState({ kind: 'error', message: `同类素材最多 ${cap} 个` });
        return;
      }
      total += f.size;
    }
    if (total > MEDIA_LIMITS.maxTotal) {
      setState({
        kind: 'error',
        message: `作品素材总大小不能超过 ${Math.round(MEDIA_LIMITS.maxTotal / 1024 / 1024)}MB`,
      });
      return;
    }
    setMediaFiles(next);
    if (state.kind === 'error') setState({ kind: 'idle' });
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddMedia(Array.from(e.target.files || []));
    // 允许连续两次选同一个文件
    e.target.value = '';
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragMediaOver(false);
    validateAndAddMedia(Array.from(e.dataTransfer?.files || []));
  };

  const handleHtmlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setState({ kind: 'error', message: '作品文件请用 .html 格式' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState({ kind: 'error', message: 'HTML 文件不能超过 5MB' });
      return;
    }
    await captureAndSubmit(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
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
    await captureAndSubmit(file);
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
    setTextbook('');
    setHtmlFile(null);
    setMediaFiles([]);
    setDragOver(false);
    setDragMediaOver(false);
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
        <h1 className="submit-h1-single">
          <span>把作品贴到这里。</span>
        </h1>
        <p>
          网页、视频、图片、文档都算作品：传 HTML 会自动帮你写介绍、生成封面；
          也可以直接上传视频介绍、图片展示，甚至只填文字。
          老师审核通过后，作品就会出现在「作品墙」上。
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
                    : state.coverSource === 'client'
                    ? '封面已用你的作品截图生成'
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

            {state.mediaCount && state.mediaCount > 0 ? (
              <p className="submit-success-media">
                已上传 {state.mediaCount} 个作品素材（图片 / 视频 / 文档），
                审核通过后会展示在作品墙上。
              </p>
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
              <Field
                label="关联教材"
                hint="选填 · 作品会归类到对应教材；自由创作可选「与教材无关」"
              >
                <TextbookPicker
                  value={textbook}
                  onChange={setTextbook}
                />
              </Field>
            </div>

            <div className="submit-divider" aria-hidden="true" />

            <div className="submit-card-head">
              <p className="mono submit-kicker">STEP 02 — 作品信息</p>
              <p className="submit-card-intro">
                网页作品（HTML）上传后会自动写介绍、生成封面；视频、图片、文档也能直接传，可以多选。
                不传 HTML 同样可以提交。
              </p>
            </div>

            <Field
              label="网页作品（HTML，选填）"
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

            <Field
              label="作品素材（图片 / 视频 / 文档）"
              hint="选填 · 可以不传 HTML，只用视频介绍或图片展示也能提交"
            >
              <label
                className={`upload-zone upload-zone--media ${
                  dragMediaOver ? 'upload-zone--over' : ''
                } ${mediaFiles.length ? 'upload-zone--has-file' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragMediaOver(true);
                }}
                onDragLeave={() => setDragMediaOver(false)}
                onDrop={handleMediaDrop}
              >
                <input
                  type="file"
                  multiple
                  accept={MEDIA_ACCEPT}
                  onChange={handleMediaChange}
                  disabled={busy}
                  className="submit-file-input"
                />
                <span className="upload-zone-icon" aria-hidden="true">
                  🎬
                </span>
                <span className="upload-zone-title">
                  {mediaFiles.length
                    ? `已选 ${mediaFiles.length} 个素材，可继续追加`
                    : '点击或拖拽图片、视频、文档到这里'}
                </span>
                <span className="upload-zone-hint">
                  图片 ≤10MB · 视频 ≤80MB · PDF/PPT/Word/ZIP ≤30MB，最多{' '}
                  {MEDIA_LIMITS.maxFiles} 个
                </span>
              </label>
              {mediaFiles.length ? (
                <ul className="submit-media-list">
                  {mediaFiles.map((f, i) => {
                    const cls = classifyMedia(f.name);
                    return (
                      <li key={`${f.name}-${i}`}>
                        <span className="submit-media-kind">
                          {cls ? MEDIA_KIND_LABEL[cls.rule.kind] : '文件'}
                        </span>
                        <span className="submit-media-name" title={f.name}>
                          {f.name}
                        </span>
                        <span className="submit-media-size">
                          {formatMediaSize(f.size)}
                        </span>
                        <button
                          type="button"
                          className="submit-media-remove"
                          aria-label={`移除 ${f.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMediaFiles((prev) =>
                              prev.filter((_, j) => j !== i),
                            );
                          }}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
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

            <Field
              label="封面图链接"
              hint="选填 · 传了图片素材会自动用第一张当封面；也可填 http(s) 图片地址"
            >
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
