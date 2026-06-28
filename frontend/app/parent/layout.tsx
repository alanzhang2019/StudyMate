import Link from 'next/link';

import ParentLogoutButton from './logout-button';

/**
 * Parent-side chrome. The route group is intentionally lax about
 * auth — parents land here from a short invite code and never
 * sign in. The /parent/bind page handles "no binding yet" via
 * the cookie check, and the dashboard page server-renders a
 * redirect when the parent cookie exists but is unbound.
 */
export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              👨‍👩‍👧
            </span>
            <h1 className="text-lg font-semibold text-slate-800">
              家长学习中心
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="text-slate-500 transition hover:text-slate-700"
            >
              返回主站
            </Link>
            <ParentLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
