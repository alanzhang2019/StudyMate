'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ParentDashboard } from '@/lib/parent/dashboard';

type Insight = ParentDashboard['insight'];

interface Props {
  initialInsight: Insight;
}

/**
 * Renders the AI commentary and lets the parent manually trigger
 * a regeneration. We POST /insight/refresh to wipe the cache
 * row, then GET /dashboard to read the freshly generated
 * insight back. Two round-trips is fine for an explicit
 * "regenerate" action.
 */
export function AiInsightCard({ initialInsight }: Props) {
  const [insight, setInsight] = useState<Insight>(initialInsight);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const refreshRes = await fetch('/api/parent/insight/refresh', {
        method: 'POST',
      });
      if (!refreshRes.ok) throw new Error('refresh failed');
      const dashboardRes = await fetch('/api/parent/dashboard');
      const data = (await dashboardRes.json()) as {
        success?: boolean;
        dashboard?: ParentDashboard;
      };
      if (data.success && data.dashboard) {
        setInsight(data.dashboard.insight);
      }
    } catch (e) {
      setErr('刷新失败，请稍后重试');
      console.error('[AiInsightCard] refresh failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            ✨
          </span>
          <h3 className="text-sm font-semibold text-slate-700">
            AI 老师点评
          </h3>
          {insight && !insight.fromCache && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
              刚刚生成
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={busy}
        >
          {busy ? '刷新中…' : '刷新评语'}
        </Button>
      </div>
      {insight ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {insight.content}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          暂时没有可用的 AI 评语。
        </p>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </Card>
  );
}
