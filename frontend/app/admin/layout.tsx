import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 font-bold text-xl border-b">Admin Panel</div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" className="block p-2 hover:bg-gray-50 rounded">📊 Dashboard</Link>
          <Link href="/admin/settings" className="block p-2 hover:bg-gray-50 rounded">⚙️ TTS Settings</Link>
          <Link href="/admin/users" className="block p-2 hover:bg-gray-50 rounded">👥 Users</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
