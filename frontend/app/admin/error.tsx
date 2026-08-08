'use client';

// /admin/error.tsx
//
// Next.js 错误边界。如果 /admin/* 任一子页面 throw（典型场景：
// 后端返回的数据结构与 UI 假设不匹配，访问 undefined.x 抛
// TypeError），Next.js 默认会把整棵客户端树炸掉，显示一整页
// "Application error: a client-side exception has occurred"。
// 在 admin 段加 error.tsx 后，崩的页面会被隔离成可读的错误
// 卡片，侧栏 nav 仍可用，学生/老师可以点回 Dashboard 继续
// 操作，不至于被卡死。

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 错误信息打到浏览器 console，方便排查；不会上报远端
    console.error('[admin] 子页面崩了', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              这个页面出错了
            </h1>
            <p className="text-sm text-slate-500">
              请刷新或返回 Dashboard。错误已记录到控制台。
            </p>
          </div>
        </div>

        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-40 text-slate-700 whitespace-pre-wrap break-words">
          {error.message}
          {error.digest && `\n(digest: ${error.digest})`}
        </pre>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm font-semibold
                       text-white bg-blue-600 hover:bg-blue-700
                       rounded-lg px-4 py-2 transition-colors"
          >
            重试
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold
                       text-slate-700 bg-slate-100 hover:bg-slate-200
                       rounded-lg px-4 py-2 transition-colors"
          >
            ← 返回 Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
