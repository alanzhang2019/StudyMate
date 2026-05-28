'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { shouldSkipConfirmation } from '@/lib/mistake/session/confidence-policy';
import { getHomeworkHomeContent } from '@/lib/mistake/ui/content';
import { buildPendingRecognizeImageUrl } from '@/lib/mistake/ui/pending-recognize-image';
import { startMistakePreview } from '@/lib/mistake/ui/start-mistake-preview';
import { writePendingRecognizeSession } from '@/lib/mistake/ui/recognize-session';
import { useProfileStore } from '@/lib/store/profile';

import { Camera } from 'lucide-react';

type ExtractResponse = {
  success: true;
  extraction: {
    problemText: string;
    studentAnswer?: string;
    correctAnswerCandidate?: string;
    confidence: number;
    needsUserConfirmation: boolean;
  };
};

type PageStatus =
  | 'idle'
  | 'extracting'
  | 'creating_session'
  | 'starting_preview'
  | 'error';

export default function MistakePage() {
  const router = useRouter();
  const { t } = useI18n();
  const activeProfile = useProfileStore((state) => state.activeProfile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState('');
  const homeContent = getHomeworkHomeContent(t);

  const previewUrl = useMemo(() => {
    if (!image) {
      return null;
    }

    return URL.createObjectURL(image);
  }, [image]);
  const isStartingPreview = status === 'creating_session' || status === 'starting_preview';
  const isExtracting = status === 'extracting';

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleExtract() {
    if (!image) {
      setError('请先上传图片');
      setStatus('error');
      return;
    }

    setStatus('extracting');
    setError('');

    const formData = new FormData();
    formData.set('image', image);
    formData.set('subject', 'math');

    console.log('[Mistake] Starting OCR request...');
    const startTime = Date.now();

    try {
      const response = await fetch('/api/mistake/session/extract', {
        method: 'POST',
        body: formData,
      });
      console.log('[Mistake] OCR response received in', Date.now() - startTime, 'ms');
      console.log('[Mistake] Response status:', response.status);

      const json = (await response.json()) as ExtractResponse | { error?: string };
      console.log('[Mistake] Response data:', json);
      const extractError = 'error' in json ? json.error : undefined;

    if (!response.ok || !('extraction' in json)) {
      setStatus('error');
      setError(extractError ?? '图片提取失败');
      return;
    }

    if (shouldSkipConfirmation(json.extraction)) {
      await startMistakeFlow(json.extraction);
      return;
    }

    if (!image) {
      setStatus('error');
      setError('题目图片预览已丢失，请重新上传');
      return;
    }

    const persistentImageUrl = await buildPendingRecognizeImageUrl(image);

    writePendingRecognizeSession({
      imageUrl: persistentImageUrl,
      ...json.extraction,
    });
    router.push('/mistake/recognize');
    } catch (err) {
      console.error('[Mistake] OCR request failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : '网络请求失败，请检查网络连接');
    }
  }

  async function startMistakeFlow(extraction: ExtractResponse['extraction']) {
    setStatus('creating_session');
    setError('');

    try {
      await startMistakePreview({
        extraction,
        problemText: extraction.problemText,
        studentAnswer: extraction.studentAnswer,
        correctAnswer: extraction.correctAnswerCandidate,
        studentName: activeProfile?.name || '学生',
        grade: activeProfile?.grade || 4,
        teachingStyle: activeProfile?.teachingStyle || '幽默风趣',
        studentProfileId: activeProfile?.id,
      });
      setStatus('starting_preview');
      router.push('/generation-preview');
    } catch (flowError) {
      setStatus('error');
      setError(flowError instanceof Error ? flowError.message : '进入讲解失败');
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-4xl gap-8 px-6 py-12">
      <input
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        type="file"
        onChange={(event) => {
          setImage(event.target.files?.[0] ?? null);
          setStatus('idle');
          setError('');
        }}
      />

      <section className="grid gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <p className="text-sm font-bold text-primary tracking-widest uppercase">{homeContent.sceneHint}</p>
        <div className="grid gap-4">
          <h1 className="text-5xl md:text-6xl font-heading font-bold tracking-tight text-foreground leading-tight">
            {homeContent.title}
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            {homeContent.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <Button onClick={() => fileInputRef.current?.click()} size="lg" type="button" variant="cta" className="text-lg">
            <Camera className="w-5 h-5 mr-2" />
            {homeContent.ctaPrimary}
          </Button>
          <Button onClick={() => router.push('/history')} size="lg" type="button" variant="secondary" className="text-lg">
            {homeContent.ctaSecondary}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        {homeContent.values.map((value, index) => (
          <Card key={value} className="p-6 hover:-translate-y-2 hover:rotate-1 transition-transform duration-300">
            <p className="text-base font-bold text-center text-primary">{value}</p>
          </Card>
        ))}
      </section>

      <Card className="grid gap-4 p-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both border-4 border-white/50 bg-white/80 backdrop-blur-sm">
        <div className="grid gap-2">
          <h2 className="text-2xl font-heading font-bold text-primary">上传题目</h2>
          <p className="text-base text-muted-foreground">{homeContent.uploadHint}</p>
          <p className="text-sm text-muted-foreground/80">{homeContent.uploadTip}</p>
        </div>

        {previewUrl ? (
          <div className="grid gap-6 md:grid-cols-[280px_1fr] mt-4">
            <div className="relative group overflow-hidden rounded-2xl border-4 border-white shadow-clay">
              <img
                alt="待识别题目预览"
                className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                src={previewUrl}
              />
            </div>
            <div className="grid content-center gap-4">
              <p className="text-sm font-medium text-foreground bg-primary/10 p-3 rounded-xl border border-primary/20">
                {image?.name ?? '已选择题目图片，下一步会先识别并请你确认。'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button disabled={isExtracting || isStartingPreview} onClick={handleExtract} type="button" variant="cta" className="flex-1 sm:flex-none">
                  {isExtracting ? '正在看这道题……' : '开始识别'}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                >
                  重新选择
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center p-12 border-4 border-dashed border-primary/20 rounded-3xl bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
            <div className="w-20 h-20 bg-white rounded-full shadow-clay flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Camera className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-heading font-bold text-primary mb-2">点击或拖拽上传</p>
            <p className="text-sm text-muted-foreground">支持 jpg, png 格式的图片</p>
          </div>
        )}

        {error ? <p className="text-sm font-bold text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20 mt-2">{error}</p> : null}
      </Card>

      <p className="text-sm font-medium text-muted-foreground/60 text-center animate-in fade-in duration-1000 delay-500 fill-mode-both">{homeContent.parentHint}</p>
    </main>
  );
}
