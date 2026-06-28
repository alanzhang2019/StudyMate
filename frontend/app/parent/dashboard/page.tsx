import { redirect } from 'next/navigation';

import { getParentVisitorId } from '@/lib/parent/visitor';
import { getDashboardForParent } from '@/lib/parent/dashboard';
import { KpiGrid } from '@/components/parent/kpi-grid';
import { SubjectPieChart } from '@/components/parent/subject-pie-chart';
import { DailyTrendChart } from '@/components/parent/daily-trend-chart';
import { MistakeList } from '@/components/parent/mistake-list';
import { AiInsightCard } from '@/components/parent/ai-insight-card';

export const dynamic = 'force-dynamic';

/**
 * Server-rendered parent dashboard.
 *
 * - No parent cookie → /parent/bind (we never silently render
 *   an empty page; this is the only way the parent reaches
 *   the bind flow from a deep link).
 * - Cookie but no active binding → /parent/bind (e.g. they
 *   revoked the only binding and refreshed).
 * - Otherwise render the full dashboard.
 */
export default async function ParentDashboardPage() {
  const parentVisitorId = await getParentVisitorId();
  if (!parentVisitorId) {
    redirect('/parent/bind');
  }

  const dashboard = await getDashboardForParent(parentVisitorId);
  if (!dashboard) {
    redirect('/parent/bind');
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">学习看板</h2>
        <p className="mt-1 text-sm text-slate-500">
          实时查看孩子的错题趋势、学科分布与最近学习活动。
        </p>
      </header>

      <KpiGrid kpis={dashboard.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AiInsightCard initialInsight={dashboard.insight} />
        <DailyTrendChart dailyTrend={dashboard.dailyTrend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SubjectPieChart
            subjectDistribution={dashboard.subjectDistribution}
          />
        </div>
        <div className="lg:col-span-2">
          <MistakeList mistakes={dashboard.recentMistakes} />
        </div>
      </div>
    </div>
  );
}
