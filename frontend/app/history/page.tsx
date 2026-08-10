import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { groupHomeworkHistory, type HomeworkHistoryItem } from '@/lib/mistake/ui/history';
import { translate } from '@/lib/i18n';
import { MISTAKE_SESSIONS_DIR } from '@/lib/mistake/session/store';
import type { MistakeSession } from '@/lib/mistake/session/types';
import { formatDateBeijing } from '@/lib/utils/date';

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent mb-3">
            {translate('zh-CN', 'homeworkHistory.title')}
          </h1>
          <p className="text-slate-600">Your learning journey and progress</p>
        </div>

        {items.length === 0 ? (
          <Card className="p-10 text-center border-0 shadow-xl shadow-blue-500/10 bg-white/80 backdrop-blur-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              {translate('zh-CN', 'homeworkHistory.emptyTitle')}
            </h2>
            <p className="text-slate-600 mb-6">
              {translate('zh-CN', 'homeworkHistory.emptyDesc')}
            </p>
            <Button asChild className="px-6 py-5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300">
              <Link href="/mistake">
                {translate('zh-CN', 'homeworkHome.ctaPrimary')}
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {grouped.pending.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  {translate('zh-CN', 'homeworkHistory.groupPending')}
                </h2>
                <div className="space-y-4">
                  {grouped.pending.map((item) => (
                    <Card key={item.id} className="p-6 border-0 shadow-lg shadow-blue-500/5 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-slate-700 leading-relaxed">{item.problemPreview}</p>
                          <p className="text-xs text-slate-400 mt-2">
                            Updated {formatDateBeijing(item.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Button asChild size="sm" variant="outline" className="border-slate-200 hover:border-blue-300 hover:bg-blue-50">
                          <Link href={item.explanationId === item.id ? '/mistake' : `/classroom/${item.explanationId}`}>
                            {translate('zh-CN', 'homeworkHistory.cardReview')}
                          </Link>
                        </Button>
                        <Button asChild size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transition-all duration-300">
                          <Link href={`/quiz/${item.id}`}>
                            {translate('zh-CN', 'homeworkHistory.cardRetry')}
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {grouped.done.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  {translate('zh-CN', 'homeworkHistory.groupDone')}
                </h2>
                <div className="space-y-4">
                  {grouped.done.map((item) => (
                    <Card key={item.id} className="p-6 border-0 shadow-md bg-white/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 opacity-90 hover:opacity-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-slate-700 leading-relaxed">{item.problemPreview}</p>
                          <p className="text-xs text-slate-400 mt-2">
                            Completed {formatDateBeijing(item.updatedAt)}
                          </p>
                        </div>
                        <div className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Button asChild size="sm" variant="outline" className="border-slate-200 hover:border-green-300 hover:bg-green-50">
                          <Link href={item.explanationId === item.id ? '/mistake' : `/classroom/${item.explanationId}`}>
                            {translate('zh-CN', 'homeworkHistory.cardReview')}
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
