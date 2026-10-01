'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * 讨论区管理：作品墙的讨论区是完全匿名的（K12 场景，降低发言门槛），
 * 所以必须有一个能立刻处理不合适内容的后台入口。
 * 这里只做两件事：按时间倒序列出评论、删除（顶层评论连带其下回复）。
 */

type CommentRow = {
  id: string;
  workId: string;
  parentId: string | null;
  authorName: string;
  authorRole: string | null;
  body: string;
  status: string;
  createdAt: string;
  workTitle: string | null;
};

export default function AdminCampCommentsPage() {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/camp/comments?limit=200', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.data ?? []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: CommentRow) => {
    const extra = row.parentId ? '' : '\n（它下面的回复也会一起删除）';
    if (!window.confirm(`删除这条评论？${extra}`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/camp/comments/${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '删除失败');
      await load();
    } catch (e: any) {
      setError(e?.message || '删除失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">讨论区管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            作品详情页的匿名评论。删除顶层评论会连带删除它下面的回复。
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
        >
          刷新
        </button>
      </div>

      {error ? (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">还没有任何评论。</p>
      ) : (
        <div className="bg-white border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-2 w-40">时间</th>
                <th className="px-4 py-2 w-56">作品</th>
                <th className="px-4 py-2 w-32">昵称</th>
                <th className="px-4 py-2">内容</th>
                <th className="px-4 py-2 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.createdAt}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/camp/work/${r.workId}#discussion`}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                    >
                      {r.workTitle || r.workId}
                    </Link>
                    {r.parentId ? (
                      <span className="ml-1 text-xs text-gray-400">（回复）</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{r.authorName}</td>
                  <td className="px-4 py-3 whitespace-pre-wrap break-words">{r.body}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void remove(r)}
                      disabled={busyId === r.id}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      {busyId === r.id ? '删除中…' : '删除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
