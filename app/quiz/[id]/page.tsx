'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/hooks/use-i18n';
import { updateMistakeSession } from '@/lib/mistake/session/client';
import type { MistakeSession } from '@/lib/mistake/session/types';
import { buildHomeworkQuiz, normalizeHomeworkAnswer } from '@/lib/mistake/ui/quiz';
import { writeSubmittedAnswers, writeSubmittedResults } from '@/lib/quiz/persistence';

export default function HomeworkQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<MistakeSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch(`/api/mistake/session/${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
          throw new Error(t('homeworkCommon.systemError'));
        }

        const json = (await response.json()) as { session?: MistakeSession };
        if (!cancelled) {
          setSession(json.session ?? null);
        }
      } catch (sessionError) {
        if (!cancelled) {
          setError(sessionError instanceof Error ? sessionError.message : t('homeworkCommon.systemError'));
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  const question = useMemo(() => {
    if (!session) return null;
    return buildHomeworkQuiz({
      problemText: session.confirmed.problemText,
      correctAnswer: session.confirmed.correctAnswer,
    }).questions[0];
  }, [session]);

  async function handleSubmit() {
    if (!session || !question) {
      return;
    }

    setSubmitting(true);
    setError('');

    const normalizedAnswer = normalizeHomeworkAnswer(answer);
    const normalizedExpected = normalizeHomeworkAnswer(question.expectedAnswer ?? '');
    const passed = normalizedAnswer.length > 0 && normalizedAnswer === normalizedExpected;

    writeSubmittedAnswers(sessionId, { [question.id]: answer });
    writeSubmittedResults(sessionId, [
      {
        questionId: question.id,
        correct: passed,
        status: passed ? 'correct' : 'incorrect',
        earned: passed ? 1 : 0,
      },
    ]);

    try {
      await updateMistakeSession(sessionId, {
        masteryStatus: passed ? 'done' : 'pending',
        parentSummary: {
          totalCount: 1,
          solvedCount: passed ? 1 : 0,
          needMoreReason: passed ? '本次同类题验证通过' : '这类题还需要再练一练',
          focusTopic: session.confirmed.problemText.slice(0, 24),
        },
      });
    } catch (updateError) {
      setSubmitting(false);
      setError(updateError instanceof Error ? updateError.message : t('homeworkCommon.systemError'));
      return;
    }

    router.push(`/quiz-result/${sessionId}`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl gap-6 px-6 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('homeworkQuiz.title')}</h1>
        <p className="text-muted-foreground">{t('homeworkQuiz.subtitle')}</p>
      </div>

      <Card className="grid gap-4 p-6">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">{question?.title ?? t('homeworkQuiz.q1Title')}</h2>
          <p className="text-sm text-muted-foreground">{question?.hint ?? t('homeworkQuiz.q1Hint')}</p>
        </div>

        <p className="whitespace-pre-wrap text-base leading-7">{question?.stem ?? '...'}</p>

        <label className="grid gap-2">
          <span className="text-sm font-medium">你的答案</span>
          <Input value={answer} onChange={(event) => setAnswer(event.target.value)} />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button disabled={submitting || !question || answer.trim().length === 0} onClick={() => void handleSubmit()} type="button">
            {t('homeworkQuiz.submit')}
          </Button>
          <Button
            onClick={() => router.push(session?.classroomId ? `/classroom/${session.classroomId}` : '/mistake')}
            type="button"
            variant="outline"
          >
            {t('homeworkQuiz.backToExplanation')}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{t('homeworkQuiz.footerTip')}</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </Card>
    </main>
  );
}
