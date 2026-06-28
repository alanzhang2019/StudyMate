import { Card } from '@/components/ui/card';
import type { DashboardKpis } from '@/lib/parent/dashboard';

interface Props {
  kpis: DashboardKpis;
}

const tiles: Array<{
  key: keyof DashboardKpis;
  label: string;
  tone: string;
  sub?: (k: DashboardKpis) => string;
}> = [
  {
    key: 'total',
    label: '总错题数',
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    key: 'resolved',
    label: '已掌握',
    tone: 'bg-emerald-50 text-emerald-700',
    sub: (k) => `掌握率 ${Math.round(k.masteryRate * 100)}%`,
  },
  {
    key: 'unresolved',
    label: '未掌握',
    tone: 'bg-rose-50 text-rose-700',
  },
  {
    key: 'recent7d',
    label: '近 7 天新增',
    tone: 'bg-violet-50 text-violet-700',
  },
];

export function KpiGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.key} className="p-4">
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${t.tone}`}>
            {kpis[t.key]}
          </p>
          {t.sub && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t.sub(kpis)}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
