'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Trash2,
  ExternalLink,
  RefreshCw,
  FileArchive,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { createLogger } from '@/lib/logger';
import { formatDateBeijing, parseStoredTimestamp } from '@/lib/utils/date';

const log = createLogger('AdminClassroomView');

type ImportItem = {
  id: string;
  title: string;
  description?: string;
  language?: string;
  style?: string;
  sceneCount: number;
  createdAt: string;
  imported: boolean;
  collection?: string;
};

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string; progress: number }
  | { kind: 'success'; item: ImportItem; url: string; warnings: string[] }
  | { kind: 'error'; message: string };

const MAX_UPLOAD_MB = 1024;
const TITLE_MAX = 200;

export type AdminClassroomViewProps = {
  /**
   * If set, uploads will be tagged with this collection key AND the
   * list will be filtered to this collection. Pass `undefined` for
   * the default "global" pool (no collection tag, show all).
   */
  collection?: string;
  /** Title shown at the top of the page. */
  pageTitle: string;
  /** Subtitle / one-liner explaining what this page is for. */
  pageDescription: string;
  /** Label shown on the empty-list call-to-action. */
  emptyHint: string;
  /** Optional badge to display next to each item (e.g. collection tag). */
  itemBadgeLabel?: string;
};

export default function AdminClassroomView({
  collection,
  pageTitle,
  pageDescription,
  emptyHint,
  itemBadgeLabel,
}: AdminClassroomViewProps) {
  const router = useRouter();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  // Single-flight guard: only one row's collection change is in flight
  // at a time. Stored as the id, or null when idle. We don't queue
  // because changes are infrequent and the list reload after a
  // successful change re-renders the new state anyway.
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  // Inline-title-edit state. While `editingTitleId === item.id` the
  // title is rendered as an input; we PATCH on Enter / blur, cancel
  // on Escape. The input is uncontrolled-on-mount (initial value
  // from `editingTitleDraft`) so the user's caret position isn't
  // reset on every keystroke.
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleDraft, setEditingTitleDraft] = useState('');
  const [savingTitleId, setSavingTitleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const listUrl =
    '/api/admin/classroom' + (collection ? `?collection=${encodeURIComponent(collection)}` : '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: ImportItem[]; total?: number };
      setItems(data.items ?? []);
    } catch (err) {
      log.error('failed to load classroom list:', err);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-focus the inline-edit input when entering edit mode.
  useEffect(() => {
    if (editingTitleId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTitleId]);

  const beginEditTitle = useCallback((it: ImportItem) => {
    setEditingTitleId(it.id);
    setEditingTitleDraft(it.title ?? '');
  }, []);

  const cancelEditTitle = useCallback(() => {
    setEditingTitleId(null);
    setEditingTitleDraft('');
  }, []);

  const saveEditTitle = useCallback(
    async (id: string) => {
      const trimmed = editingTitleDraft.trim();
      const current = items.find((x) => x.id === id)?.title ?? '';
      // No-op: empty input or unchanged value. We treat empty as
      // "cancel" so the user can't accidentally wipe the title.
      if (trimmed.length === 0) {
        cancelEditTitle();
        return;
      }
      if (trimmed === current) {
        cancelEditTitle();
        return;
      }
      if (savingTitleId) return; // another row is mid-save
      setSavingTitleId(id);
      try {
        const res = await fetch(
          `/api/admin/classroom/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          name?: string | null;
        };
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        // Optimistically reflect the new title in the local list so
        // the row doesn't visibly "snap back" to the old value while
        // the next list fetch is in flight.
        setItems((prev) =>
          prev.map((x) => (x.id === id ? { ...x, title: data.name ?? trimmed } : x)),
        );
        cancelEditTitle();
        // Also nudge RSC caches so the public `/csp-lecture` page
        // picks up the new title on the next render.
        router.refresh();
      } catch (err) {
        alert(
          `保存标题失败：${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSavingTitleId(null);
      }
    },
    [cancelEditTitle, editingTitleDraft, items, router, savingTitleId],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const filename = file.name || 'upload.zip';
      if (file.size === 0) {
        setUpload({ kind: 'error', message: '文件为空' });
        return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setUpload({ kind: 'error', message: `文件超过 ${MAX_UPLOAD_MB}MB 上限` });
        return;
      }
      if (!/\.(zip|maic\.zip)$/i.test(filename)) {
        setUpload({ kind: 'error', message: '文件必须是 .zip 或 .maic.zip' });
        return;
      }
      setUpload({ kind: 'uploading', filename, progress: 0 });

      const form = new FormData();
      form.append('file', file);
      if (collection) form.append('collection', collection);

      try {
        // We don't actually have streaming upload progress, so we
        // fake a "uploading" state and just wait for the response.
        // The form-data encode + the server-side parse takes most of
        // the wall time for big files.
        const res = await fetch('/api/admin/classroom/import', {
          method: 'POST',
          body: form,
        });
        // Read the body once, as text, then try to parse it as JSON.
        // Some failures (proxy timeouts, body-size limits upstream)
        // return a 500 with an empty / non-JSON body, which would
        // otherwise surface as the useless "HTTP 500" fallback.
        const rawBody = await res.text();
        let data: {
          success?: boolean;
          error?: string;
          errorCode?: string;
          id?: string;
          title?: string;
          url?: string;
          sceneCount?: number;
          mediaCount?: number;
          warnings?: string[];
        } = {};
        try {
          data = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          // Non-JSON body. Fall through with `data = {}` and surface
          // the raw text in the error message below.
        }
        if (!res.ok || !data.success) {
          const fallback =
            rawBody && rawBody.length > 0 && rawBody.length < 500
              ? `HTTP ${res.status}: ${rawBody}`
              : `HTTP ${res.status}`;
          setUpload({
            kind: 'error',
            message: data.error || fallback,
          });
          return;
        }
        setUpload({
          kind: 'success',
          item: {
            id: data.id!,
            title: data.title ?? 'Untitled',
            sceneCount: data.sceneCount ?? 0,
            createdAt: new Date().toISOString(),
            imported: true,
            collection,
          },
          url: data.url ?? '',
          warnings: data.warnings ?? [],
        });
        await load();
        router.refresh();
      } catch (err) {
        setUpload({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [collection, load, router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`确定要删除 "${title}" 吗？\n\n删除后无法恢复，所有音频和图片也会一并删除。`)) {
        return;
      }
      try {
        const res = await fetch(`/api/admin/classroom/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          // Prefer `details` over `error` so the actual cause
          // (e.g. "EACCES: permission denied, unlink ...") reaches
          // the operator — `error` is just a generic Chinese label
          // like "failed to delete classroom" and is useless for
          // diagnosis. The DELETE route sets `details` to
          // `err.message` on 500, so EACCES / ENOENT / EROFS all
          // surface here.
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            details?: string;
          };
          const msg = data.details || data.error || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        await load();
        router.refresh();
      } catch (err) {
        alert(`删除失败：${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [load, router],
  );

  const onChangeCollection = useCallback(
    async (id: string, next: string | null) => {
      if (busyCollectionId) return;
      setBusyCollectionId(id);
      try {
        const res = await fetch(
          `/api/admin/classroom/${encodeURIComponent(id)}/collection`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: next }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          changed?: boolean;
        };
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        // After moving, the active list filter may no longer include
        // this item (e.g. moved out of the current collection, or moved
        // INTO it from the default pool when viewing /admin/csp-lecture
        // with a filter). Either way, a full reload + RSC refresh is
        // the simplest correct behaviour.
        await load();
        router.refresh();
      } catch (err) {
        alert(
          `更新集合失败：${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setBusyCollectionId(null);
      }
    },
    [busyCollectionId, load, router],
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{pageDescription}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新列表
        </Button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-sky-500 bg-sky-50'
            : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50',
        ].join(' ')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.maic.zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // reset so re-selecting the same file still fires onChange
            e.target.value = '';
          }}
        />
        <Upload className="w-10 h-10 mx-auto text-gray-400" />
        <div className="mt-3 text-base font-medium text-gray-700">
          {upload.kind === 'uploading'
            ? `上传中… ${upload.filename}`
            : '拖拽 .maic.zip 到此处'}
        </div>
        <div className="mt-1 text-sm text-gray-500">
          或点击选择文件 · 最多 {MAX_UPLOAD_MB}MB
        </div>
        <div className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-1">
          <FileArchive className="w-3 h-3" />
          OpenMAIC 头部 → 导出按钮
        </div>
      </div>

      {/* Upload status feedback */}
      {upload.kind === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          上传失败：{upload.message}
        </div>
      )}
      {upload.kind === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="font-medium">
            导入成功：「{upload.item.title}」（{upload.item.sceneCount} 个场景）
          </div>
          {upload.warnings.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-amber-700">
              {upload.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <a
              href={upload.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-600 hover:underline"
            >
              打开课堂 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {itemBadgeLabel ? `${itemBadgeLabel} (${items.length})` : `已导入的课堂 (${items.length})`}
            </h2>
          </div>

          {loading ? (
            <div className="text-gray-500 py-4">加载中…</div>
          ) : items.length === 0 ? (
            <div className="text-gray-500 py-8 text-center text-sm">{emptyHint}</div>
          ) : (
            <div className="divide-y">
              {items.map((it) => {
                const isEditing = editingTitleId === it.id;
                const isSaving = savingTitleId === it.id;
                return (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-3 items-center py-3"
                  >
                    <div className="col-span-6">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitleDraft}
                            maxLength={TITLE_MAX}
                            disabled={isSaving}
                            onChange={(e) => setEditingTitleDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveEditTitle(it.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEditTitle();
                              }
                            }}
                            onBlur={() => {
                              // Defer slightly so a click on the
                              // "save" / "cancel" buttons (rendered
                              // next to the input) lands before we
                              // exit edit mode.
                              window.setTimeout(() => {
                                if (editingTitleId === it.id) {
                                  void saveEditTitle(it.id);
                                }
                              }, 120);
                            }}
                            className="flex-1 min-w-0 px-2 py-1 text-sm border border-sky-400 rounded
                                       focus:outline-none focus:ring-2 focus:ring-sky-300
                                       disabled:bg-gray-50 disabled:text-gray-400"
                            placeholder="课件标题"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault() /* keep focus, no blur double-fire */}
                            onClick={() => void saveEditTitle(it.id)}
                            disabled={isSaving || editingTitleDraft.trim().length === 0}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded
                                       disabled:opacity-40 disabled:hover:bg-transparent"
                            title="保存"
                            aria-label="保存标题"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={cancelEditTitle}
                            disabled={isSaving}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded
                                       disabled:opacity-40"
                            title="取消"
                            aria-label="取消编辑"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEditTitle(it)}
                          className="group flex items-center gap-2 text-left max-w-full
                                     rounded px-1 -mx-1 py-0.5 hover:bg-sky-50 transition-colors"
                          title="点击修改标题"
                        >
                          <span className="font-medium text-gray-900 truncate">
                            {it.title || '未命名'}
                          </span>
                          {it.imported && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                              导入
                            </span>
                          )}
                          <Pencil
                            className="shrink-0 w-3.5 h-3.5 text-gray-300 group-hover:text-sky-600 transition-colors"
                            aria-hidden
                          />
                        </button>
                      )}
                      {it.description && !isEditing && (
                        <div className="text-xs text-gray-500 line-clamp-1 mt-0.5 px-1">
                          {it.description}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-gray-600 text-center">
                      {it.sceneCount} 场景
                    </div>
                    <div className="col-span-2 text-xs text-gray-500 text-center">
                      {formatDate(it.createdAt)}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1 items-center">
                      <CollectionSelect
                        value={it.collection}
                        disabled={busyCollectionId === it.id}
                        onChange={(next) => void onChangeCollection(it.id, next)}
                      />
                      <a
                        href={`/classroom/${it.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-gray-100 rounded"
                        title="打开"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => void onDelete(it.id, it.title)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = parseStoredTimestamp(iso);
    if (!d) return iso;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} 天前`;
    return formatDateBeijing(iso);
  } catch {
    return iso;
  }
}

// Options the admin can pick from. Mirrors the whitelist enforced on
// the server in `app/api/admin/classroom/[id]/collection/route.ts`.
// The empty string maps to "default pool" (no `collection` tag on
// the persisted JSON) which is what /admin/classroom shows.
const COLLECTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '默认池' },
  { value: 'csp-lecture', label: 'CSP初赛' },
];

function CollectionSelect({
  value,
  disabled,
  onChange,
}: {
  value?: string;
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  // The select is uncontrolled-free: we always render the current
  // `value` (defaulting to "" for the default pool), so a server
  // rejection reverts the visual state too.
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v.length === 0 ? null : v);
      }}
      title="移动到集合"
      aria-label="移动到集合"
      className={[
        'h-7 text-xs rounded border border-gray-200 bg-white px-1.5 pr-1',
        'focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400',
        disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-gray-400',
      ].join(' ')}
    >
      {COLLECTION_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
