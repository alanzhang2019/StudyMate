import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// TODO(security): this endpoint is currently open. Wrap it in the
// same `verifyAdminToken` middleware that should protect every other
// /api/admin/* route. We surface only aggregate event counts here
// (no PII) so the risk is limited, but it should still require a
// logged-in admin.

export async function GET() {
  try {
    // The Prisma-compat shim's findMany only supports `=` in where
    // clauses, so we just pull every event and bucket in JS. The
    // usage_events table is small (admin analytics, not request
    // logs) so this is fine. If volume grows we add a dedicated
    // SQL helper.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const allRows = await db.usageEvent.findMany({});
    const rows = (allRows as any[]).filter(
      (r) => (r.createdAt as string) >= since,
    );

    // Per-event totals
    const totals: Record<string, number> = {};
    // Per-day, per-event counts
    const daily: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const name = r.eventName;
      totals[name] = (totals[name] ?? 0) + 1;
      const day = (r.createdAt as string).slice(0, 10);
      if (!daily[day]) daily[day] = {};
      daily[day][name] = (daily[day][name] ?? 0) + 1;
    }

    // Build a dense 30-day series so the admin chart can render
    // empty days as zeros instead of gaps.
    const series: { date: string; counts: Record<string, number> }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      series.push({ date: d, counts: daily[d] ?? {} });
    }

    return NextResponse.json({
      totals,
      series,
      windowDays: 30,
    });
  } catch (err) {
    console.error('[admin/stats] failed:', err);
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
