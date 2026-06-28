'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface InviteResponse {
  success?: boolean;
  code?: string;
  expiresAt?: string;
  ttlSeconds?: number;
  error?: string;
}

/**
 * The student opens this dialog, the dialog immediately mints
 * a 6-digit code bound to the student's visitorId, and we ask
 * them to read the code out to the parent.
 */
export function InviteCodeDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/parent/invite/create', {
        method: 'POST',
      });
      const json = (await res.json()) as InviteResponse;
      if (!res.ok || !json.code) {
        setError(json.error || '生成失败');
        return;
      }
      setData(json);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setData(null);
          setError(null);
          void generate();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <span aria-hidden>👨‍👩‍👧</span>
          邀请父母看学习看板
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>邀请父母看学习看板</DialogTitle>
          <DialogDescription>
            把下面 6 位数字告诉你爸妈，他们输入后就能在自己的手机上看到你的学习看板。
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {loading && (
            <p className="text-center text-sm text-slate-400">正在生成…</p>
          )}
          {error && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}
          {data?.code && (
            <div className="space-y-3">
              <p className="text-center font-mono text-4xl font-bold tracking-[0.3em] text-blue-600">
                {data.code}
              </p>
              <p className="text-center text-xs text-slate-400">
                码在 10 分钟内有效，过期后请重新生成
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={generate}
              disabled={loading}
              className="flex-1"
            >
              重新生成
            </Button>
            <Button
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
