import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 font-bold text-xl border-b">管理后台</div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" className="block p-2 hover:bg-gray-50 rounded">📊 数据看板</Link>
          <Link href="/admin/classroom" className="block p-2 hover:bg-gray-50 rounded">📚 课堂管理</Link>
          <Link href="/admin/csp-lecture" className="block p-2 hover:bg-gray-50 rounded">🎓 CSP初赛要点精讲</Link>
          <Link href="/admin/csp-progress" className="block p-2 hover:bg-gray-50 rounded">📊 学生打卡进度</Link>
          <Link href="/admin/settings" className="block p-2 hover:bg-gray-50 rounded">⚙️ TTS 设置</Link>
          <Link href="/admin/users" className="block p-2 hover:bg-gray-50 rounded">👥 用户管理</Link>
        </nav>
        {/* 退出登录按钮：放在侧栏底部，避免和主导航混在一起。
            跳转 NextAuth 默认的 /api/auth/signout 确认页（GET 方法），
            那里点蓝色 "Sign out" 才真正清掉 session cookie。 */}
        <div className="p-4 border-t">
          <a
            href="/api/auth/signout"
            className="block p-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
          >
            🚪 退出登录
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
