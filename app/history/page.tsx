import { promises as fs } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { groupHomeworkHistory, type HomeworkHistoryItem } from '@/lib/mistake/ui/history';
import { translate } from '@/lib/i18n';
import { MISTAKE_SESSIONS_DIR } from '@/lib/mistake/session/store';
import type { MistakeSession } from '@/lib/mistake/session/types';

async function loadHistoryItems(): Promise<HomeworkHistoryItem[]> {
  try {
    const entries = await fs.readdir(MISTAKE_SESSIONS_DIR);
    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map(async (entry) => {
          const raw = await fs.readFile(path.join(MISTAKE_SESSIONS_DIR, entry), 'utf-8');
          return JSON.parse(raw) as MistakeSession;
        }),
    );

    return sessions
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((session) => ({
        id: session.id,
        problemPreview: session.confirmed.problemText,
        status: session.masteryStatus === 'done' ? 'done' : 'pending',
        updatedAt: Date.parse(session.updatedAt),
        explanationId: session.classroomId ?? session.id,
      }));
  } catch {
    return [];
  }
}

export default async function HomeworkHistoryPage() {
  const items = await loadHistoryItems();
  const grouped = groupHomeworkHistory(items);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-4xl gap-6 px-6 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{translate('zh-CN', 'homeworkHistory.title')}</h1>
      </div>

      {items.length === 0 ? (
        <Card className="grid gap-2 p-6">
          <h2 className="text-lg font-semibold">{translate('zh-CN', 'homeworkHistory.emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{translate('zh-CN', 'homeworkHistory.emptyDesc')}</p>
          <div>
            <Button asChild>
              <Link href="/mistake">{translate('zh-CN', 'homeworkHome.ctaPrimary')}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">{translate('zh-CN', 'homeworkHistory.groupPending')}</h2>
            <div className="grid gap-3">
              {grouped.pending.map((item) => (
                <Card key={item.id} className="grid gap-3 p-5">
                  <p className="text-sm leading-6">{item.problemPreview}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.explanationId === item.id ? '/mistake' : `/classroom/${item.explanationId}`}>
                        {translate('zh-CN', 'homeworkHistory.cardReview')}
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/quiz/${item.id}`}>{translate('zh-CN', 'homeworkHistory.cardRetry')}</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">{translate('zh-CN', 'homeworkHistory.groupDone')}</h2>
            <div className="grid gap-3">
              {grouped.done.map((item) => (
                <Card key={item.id} className="grid gap-3 p-5">
                  <p className="text-sm leading-6">{item.problemPreview}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.explanationId === item.id ? '/mistake' : `/classroom/${item.explanationId}`}>
                        {translate('zh-CN', 'homeworkHistory.cardReview')}
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
