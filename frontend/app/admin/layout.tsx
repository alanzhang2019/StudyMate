'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 font-bold text-xl border-b">管理后台</div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs text-gray-400 uppercase tracking-wider px-2 pt-3 pb-1">
            核心看板
          </div>
          <Link href="/admin" className="block p-2 hover:bg-gray-50 rounded">
            📊 数据看板
          </Link>
          <Link href="/admin/users" className="block p-2 hover:bg-gray-50 rounded">
            👥 用户管理
          </Link>

          <div className="text-xs text-gray-400 uppercase tracking-wider px-2 pt-4 pb-1">
            CSP 初赛
          </div>
          <Link href="/admin/classroom" className="block p-2 hover:bg-gray-50 rounded">
            📚 课堂管理
          </Link>
          <Link href="/admin/csp-lecture" className="block p-2 hover:bg-gray-50 rounded">
            🎓 CSP初赛要点精讲
          </Link>
          <Link href="/admin/csp-progress" className="block p-2 hover:bg-gray-50 rounded">
            📊 学生打卡进度
          </Link>
          <Link href="/admin/settings" className="block p-2 hover:bg-gray-50 rounded">
            ⚙️ TTS 设置
          </Link>

          <div className="text-xs text-gray-400 uppercase tracking-wider px-2 pt-4 pb-1">
            Alan张老师·创造营
          </div>
          <Link
            href="/admin/camp/works"
            className="block p-2 hover:bg-gray-50 rounded"
          >
            🖼️ 作品审核
          </Link>
          <Link
            href="/admin/camp/students"
            className="block p-2 hover:bg-gray-50 rounded"
          >
            👶 学员管理
          </Link>
          <Link
            href="/admin/camp/logs"
            className="block p-2 hover:bg-gray-50 rounded"
          >
            📝 课堂记录
          </Link>
        </nav>
        {/* Admin logout — clear the JWT `admin_token` cookie via the
            dedicated /api/admin/logout route, then bounce to the login
            page. The old link to /api/auth/signout only cleared
            NextAuth session cookies (student / parent auth), leaving
            the admin session alive. */}
        <div className="p-4 border-t">
          <a
            href="/api/admin/logout"
            className="block p-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
          >
            🚪 退出登录
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
