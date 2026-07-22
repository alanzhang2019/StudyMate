'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, ExternalLink, RefreshCw, FileArchive } from 'lucide-react';
import { createLogger } from '@/lib/logger';

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

const MAX_UPLOAD_MB = 100;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          errorCode?: string;
          id?: string;
          title?: string;
          url?: string;
          sceneCount?: number;
          mediaCount?: number;
          warnings?: string[];
        };
        if (!res.ok || !data.success) {
          setUpload({
            kind: 'error',
            message: data.error || `HTTP ${res.status}`,
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
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
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
              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-3 items-center py-3"
                >
                  <div className="col-span-6">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {it.title}
                      {it.imported && (
                        <span className="text-[10px] uppercase tracking-wider text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                          导入
                        </span>
                      )}
                    </div>
                    {it.description && (
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} 天前`;
    return d.toLocaleDateString('zh-CN');
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
