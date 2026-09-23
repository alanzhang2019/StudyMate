'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Item = {
  id: string;
  room: string;
  type: 'file' | 'text';
  title: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  content: string | null;
  author: string;
  createdAt: string;
  downloadUrl: string | null;
};

function randomRoom(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileEmoji(name: string | null, mime: string | null): string {
  const m = (mime || '').toLowerCase();
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'heic', 'avif', 'tif', 'tiff'].includes(ext)) return '🖼️';
  if (m.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'flv'].includes(ext)) return '🎬';
  if (m.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return '🎵';
  if (ext === 'pdf') return '📕';
  if (['doc', 'docx', 'pages', 'rtf', 'odt'].includes(ext)) return '📘';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return '📙';
  if (['xls', 'xlsx', 'numbers', 'csv', 'ods'].includes(ext)) return '📗';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'iso', 'dmg', 'cab', 'jar'].includes(ext)) return '🗜️';
  // 源码 & 工程文件
  if (['c', 'h', 'hpp', 'cc', 'cxx', 'cpp', 'hh', 'tpp', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'sql', 'swift', 'kt', 'lua', 'cs', 'pas', 'asm', 'dart', 'scala', 'r', 'm', 'mm', 'groovy'].includes(ext)) return '💻';
  if (['html', 'htm', 'css', 'scss', 'vue', 'svelte'].includes(ext)) return '🌐';
  if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'env'].includes(ext)) return '⚙️';
  return '📎';
}

export default function SharedClipboard() {
  const [room, setRoom] = useState('public');
  const [author, setAuthor] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(
    async (r: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/clipboard?room=${encodeURIComponent(r)}`);
        const json = await res.json();
        if (json.success) setItems(json.data || []);
        else setError(json.error || '加载失败');
      } catch {
        setError('网络错误，加载失败');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 读取 URL ?room= 或默认 public（避免 useSearchParams 的 Suspense 构建要求）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) setRoom(r.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'public');
  }, []);

  useEffect(() => {
    loadItems(room);
  }, [room, loadItems]);

  const shareUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
    return url;
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 2000);
    } catch {
      setError('复制失败，请手动复制地址栏链接');
    }
  };

  const newRoom = () => {
    const r = randomRoom();
    setRoom(r);
    window.history.replaceState(null, '', `?room=${r}`);
  };

  const switchRoom = (r: string) => {
    const clean = r.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
    if (!clean) return;
    setRoom(clean);
    window.history.replaceState(null, '', `?room=${encodeURIComponent(clean)}`);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('room', room);
      form.append('author', author);
      const res = await fetch('/api/clipboard', { method: 'POST', body: form });
      const json = await res.json();
      if (json.success) {
        setSuccess(`已上传：${file.name}`);
        setItems((prev) => [json.data, ...prev]);
      } else {
        setError(json.error || '上传失败');
      }
    } catch {
      setError('网络错误，上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onFilesPicked = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => uploadFile(f));
  };

  const postText = async () => {
    const c = text.trim();
    if (!c) {
      setError('请输入要分享的文本');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, author, content: c }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess('文本已发布');
        setText('');
        setItems((prev) => [json.data, ...prev]);
      } else {
        setError(json.error || '发布失败');
      }
    } catch {
      setError('网络错误，发布失败');
    } finally {
      setUploading(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      const res = await fetch(`/api/clipboard/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) setItems((prev) => prev.filter((it) => it.id !== id));
      else setError(json.error || '删除失败');
    } catch {
      setError('网络错误，删除失败');
    }
  };

  const copyText = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setSuccess('文本已复制到剪贴板');
    } catch {
      setError('复制失败');
    }
  };

  // 全局监听 Ctrl+V / Cmd+V 粘贴文件
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        onFilesPicked(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-6 sm:p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors">📋 共享剪贴板</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            老师和同学在同个房间码下，拖拽 / 粘贴文件或文本即可共享资料
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onBlur={(e) => switchRoom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') switchRoom((e.target as HTMLInputElement).value);
            }}
            placeholder="房间码"
            className="w-32 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-colors"
          />
          <button
            onClick={newRoom}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
          >
            + 新建房间
          </button>
          <button
            onClick={copyShareLink}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            {copiedRoom ? '已复制链接' : '复制分享链接'}
          </button>
        </div>
      </div>

      {/* 上传区 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFilesPicked(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-6 text-center ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => onFilesPicked(e.target.files)}
        />
        <div className="text-3xl mb-2">📥</div>
        <p className="text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors">
          点击选择文件，或把文件拖到这里，或直接 Ctrl+V 粘贴
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 transition-colors">单个文件 ≤ 20MB · 支持文档/图片/音视频/压缩包/源代码（C++、Python…）等</p>
      </div>

      {/* 署名 + 文本发布 */}
      <div className="mt-4 flex flex-col gap-3">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="你的名字（选填，默认匿名）"
          maxLength={40}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-colors"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="或者粘贴一段文字 / 链接，点击「发布文本」共享给同学"
            rows={2}
            maxLength={8000}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-colors"
          />
          <button
            onClick={postText}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white whitespace-nowrap"
          >
            发布文本
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400 transition-colors">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-600 dark:text-green-400 transition-colors">{success}</p>}

      {/* 列表 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">
            房间「{room}」的资料（{items.length}）
          </h4>
          <button
            onClick={() => loadItems(room)}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 transition-colors">加载中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 transition-colors">这个房间还没有资料，快来上传第一份吧～</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 transition-colors"
              >
                <div className="text-2xl flex-shrink-0">
                  {it.type === 'file' ? fileEmoji(it.fileName, it.mimeType) : '📝'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate transition-colors">{it.title}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 transition-colors">
                    {it.author} · {formatTime(it.createdAt)}
                    {it.fileSize ? ` · ${formatBytes(it.fileSize)}` : ''}
                  </div>
                  {it.type === 'text' && it.content && (
                    <div className="mt-1">
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [it.id]: !prev[it.id] }))
                        }
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400 transition-colors"
                      >
                        {expanded[it.id] ? '收起' : '预览'}
                      </button>
                      {expanded[it.id] && (
                        <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 rounded-lg p-2 max-h-40 overflow-auto dark:text-slate-300 dark:bg-slate-900 transition-colors">
                          {it.content}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {it.type === 'file' && it.downloadUrl ? (
                    <a
                      href={it.downloadUrl}
                      download={it.fileName || 'file'}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      下载
                    </a>
                  ) : (
                    <button
                      onClick={() => copyText(it.id, it.content || '')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      复制
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-400 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 text-xs text-slate-400 dark:text-slate-500 transition-colors">
        资料仅保存在当前房间码下，分享链接给同学即可一起查看与下载；文件上限 20MB，链接长期有效。
      </p>
    </div>
  );
}
