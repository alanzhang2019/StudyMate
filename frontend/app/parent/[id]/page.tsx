import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { readMistakeSession } from '@/lib/mistake/session/store';
import { translate } from '@/lib/i18n';

export default async function ParentSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await readMistakeSession(id);

  if (!session) {
    notFound();
  }

  const summary = session.parentSummary ?? {
    totalCount: 1,
    solvedCount: session.masteryStatus === 'done' ? 1 : 0,
    needMoreReason: session.masteryStatus === 'done' ? '本次同类题验证已通过' : '这类题还需要再练一练',
    focusTopic: session.confirmed.problemText.slice(0, 24),
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl gap-6 px-6 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{translate('zh-CN', 'homeworkParent.title')}</h1>
      </div>

      <div className="grid gap-4">
        <Card className="p-5 text-sm">
          {translate('zh-CN', 'homeworkParent.summaryTotal', { count: summary.totalCount })}
        </Card>
        <Card className="p-5 text-sm">
          {translate('zh-CN', 'homeworkParent.summarySolved', { count: summary.solvedCount })}
        </Card>
        <Card className="p-5 text-sm">
          {translate('zh-CN', 'homeworkParent.summaryNeedMore', { reason: summary.needMoreReason })}
        </Card>
        <Card className="p-5 text-sm">
          {translate('zh-CN', 'homeworkParent.summaryFocus', { topic: summary.focusTopic })}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/mistake">{translate('zh-CN', 'homeworkCommon.backHome')}</Link>
        </Button>
        {session.classroomId ? (
          <Button asChild variant="outline">
            <Link href={`/classroom/${session.classroomId}`}>{translate('zh-CN', 'homeworkQuiz.backToExplanation')}</Link>
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{translate('zh-CN', 'homeworkParent.footerTip')}</p>
    </main>
  );
}
