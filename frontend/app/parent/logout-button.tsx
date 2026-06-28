'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Clears the parent-only cookie and bounces the user back to
 * the bind page. We hit a tiny API route so the cookie removal
 * happens in the same response that the browser sees.
 */
export default function ParentLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/parent/logout', { method: 'POST' });
    } catch {
      // Even if the network call fails, the local cookie may
      // still be cleared; carry on to the bind page so the user
      // can re-enter a code.
    }
    router.replace('/parent/bind');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-slate-500 transition hover:text-rose-600 disabled:opacity-50"
    >
      {busy ? '退出中…' : '退出家长端'}
    </button>
  );
}
