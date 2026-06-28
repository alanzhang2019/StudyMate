'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * The first page a parent lands on. They type the 6-digit code
 * the student generated; we POST it to /api/parent/invite/redeem
 * which sets the parent cookie and creates the binding.
 */
export default function ParentBindPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('请输入 6 位数字');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/parent/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '绑定失败，请稍后重试');
        return;
      }
      router.replace('/parent/dashboard');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md sm:mt-12">
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-slate-800">
          绑定到你的孩子
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          让孩子在「我的错题本」点击「邀请父母」，把生成的 6 位数字告诉你。
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            placeholder="6 位数字"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            disabled={busy}
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button
            disabled={busy || code.length !== 6}
            className="w-full"
          >
            {busy ? '绑定中…' : '绑定'}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-400">
        绑定一次后，这台设备访问家长端会直接进入孩子的看板，无需再次输入。
      </p>
    </div>
  );
}
