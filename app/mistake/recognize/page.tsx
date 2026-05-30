'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  clearPendingRecognizeSession,
  readPendingRecognizeSession,
  type PendingRecognizeSession,
} from '@/lib/mistake/ui/recognize-session';
import {
  loadPendingRecognizeImage,
  cleanupPendingRecognizeImage,
} from '@/lib/mistake/ui/pending-recognize-image';
import { shouldShowRecognizeFailure } from '@/lib/mistake/ui/recognize-state';
import { startMistakePreview } from '@/lib/mistake/ui/start-mistake-preview';
import { useProfileStore } from '@/lib/store/profile';

export default function MistakeRecognizePage() {
  const router = useRouter();
  const { t } = useI18n();
  const activeProfile = useProfileStore((state) => state.activeProfile);
  const [pending, setPending] = useState<PendingRecognizeSession | null>(null);
  const [problemText, setProblemText] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    const stored = readPendingRecognizeSession();
    setPending(stored);
    if (!stored) {
      setError(t('homeworkRecognize.failDesc'));
      return;
    }

    setProblemText(stored.problemText);
    setStudentAnswer(stored.studentAnswer ?? '');
    setCorrectAnswer(stored.correctAnswerCandidate ?? '');

    // Load image from IndexedDB if stored as a storage key
    loadPendingRecognizeImage(stored.imageUrl).then((url) => {
      if (url) {
        setImageUrl(url);
      }
    });
  }, [t]);

  const showFailure = shouldShowRecognizeFailure(pending);

  async function handleConfirm() {
    if (!pending) {
      setError(t('homeworkRecognize.failDesc'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      console.log('[Recognize] Starting preview with:', {
        problemText,
        studentAnswer,
        correctAnswer,
        hasProfile: !!activeProfile,
        profileName: activeProfile?.name,
      });

      const sessionId = await startMistakePreview({
        extraction: pending,
        problemText,
        studentAnswer: studentAnswer || undefined,
        correctAnswer: correctAnswer || undefined,
        studentName: activeProfile?.name,
        grade: activeProfile?.grade,
        teachingStyle: activeProfile?.teachingStyle,
        studentProfileId: activeProfile?.id,
      });

      console.log('[Recognize] Preview started, sessionId:', sessionId);

      clearPendingRecognizeSession();
      cleanupPendingRecognizeImage(pending.imageUrl);

      console.log('[Recognize] Navigating to generation-preview...');
      router.push('/generation-preview');
    } catch (flowError) {
      console.error('[Recognize] handleConfirm error:', flowError);
      setSubmitting(false);
      setError(flowError instanceof Error ? flowError.message : t('homeworkCommon.systemError'));
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-4xl gap-6 px-6 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {showFailure ? t('homeworkRecognize.failTitle') : t('homeworkRecognize.title')}
        </h1>
        <p className="text-muted-foreground">
          {showFailure ? t('homeworkRecognize.failDesc') : t('homeworkRecognize.desc')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          {imageUrl || pending?.imageUrl ? (
            <img alt="识别确认题目图片" className="h-full w-full object-contain bg-muted/30" src={imageUrl || pending?.imageUrl} />
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center p-6 text-sm text-muted-foreground">
              {t('homeworkRecognize.failTitle')}
            </div>
          )}
        </Card>

        <Card className="grid gap-4 p-6">
          {showFailure ? (
            <>
              <p className="text-sm text-muted-foreground">{t('homeworkRecognize.failDesc')}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    clearPendingRecognizeSession();
                    router.push('/mistake');
                  }}
                  type="button"
                >
                  {t('homeworkRecognize.retry')}
                </Button>
                <Button onClick={() => router.push('/mistake')} type="button" variant="outline">
                  {t('homeworkCommon.backHome')}
                </Button>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          ) : (
            <>
          <label className="grid gap-2">
            <span className="text-sm font-medium">题干</span>
            <Textarea rows={6} value={problemText} onChange={(event) => setProblemText(event.target.value)} />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">学生答案</span>
            <Input value={studentAnswer} onChange={(event) => setStudentAnswer(event.target.value)} />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={submitting || problemText.trim().length === 0}
              onClick={() => void handleConfirm()}
              type="button"
            >
              {submitting ? t('homeworkLoading.title') : t('homeworkRecognize.confirm')}
            </Button>
            <Button
              onClick={() => {
                clearPendingRecognizeSession();
                router.push('/mistake');
              }}
              type="button"
              variant="outline"
            >
              {t('homeworkRecognize.retry')}
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
