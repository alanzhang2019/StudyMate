'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { MistakeSession } from '@/lib/mistake/session/types';
import { readSubmittedState } from '@/lib/quiz/persistence';

export default function HomeworkQuizResultPage() {
  const params = useParams();
  const { t } = useI18n();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<MistakeSession | null>(null);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const submitted = readSubmittedState(sessionId);
    if (submitted?.kind === 'reviewing') {
      setPassed(submitted.results.some((item) => item.correct));
    }

    let cancelled = false;
    const loadSession = async () => {
      const response = await fetch(`/api/mistake/session/${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        return;
      }

      const json = (await response.json()) as { session?: MistakeSession };
      if (!cancelled) {
        setSession(json.session ?? null);
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const title = passed ? t('homeworkQuizResult.successTitle') : t('homeworkQuizResult.failTitle');
  const desc = passed ? t('homeworkQuizResult.successDesc') : t('homeworkQuizResult.failDesc');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
      <Card className="grid w-full gap-5 p-8">
        <div className="grid gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{desc}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {passed ? (
            <>
              <Button asChild>
                <Link href="/mistake">{t('homeworkQuizResult.successPrimary')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/history">{t('homeworkQuizResult.successSecondary')}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href={session?.classroomId ? `/classroom/${session.classroomId}` : '/mistake'}>
                  {t('homeworkQuizResult.failPrimary')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={session?.classroomId ? `/classroom/${session.classroomId}` : '/mistake'}>
                  {t('homeworkQuizResult.failSecondary')}
                </Link>
              </Button>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
