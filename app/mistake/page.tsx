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

    const response = await fetch('/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });
    const json = (await response.json()) as ExtractResponse | { error?: string };
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
    <main className="mx-auto grid min-h-screen w-full max-w-4xl gap-8 px-6 py-12 bg-slate-50 text-slate-800 font-sans">
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
        <p className="text-sm font-bold text-slate-500 tracking-widest uppercase">{homeContent.sceneHint}</p>
        <div className="grid gap-4">
          <h1 className="text-5xl md:text-6xl font-heading font-extrabold tracking-tight text-slate-800 leading-tight">
            {homeContent.title}
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-slate-500 leading-relaxed font-medium">
            {homeContent.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <Button onClick={() => fileInputRef.current?.click()} size="lg" type="button" className="text-lg bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-2xl shadow-lg shadow-amber-400/30 font-bold border-b-4 border-amber-500 active:border-b-0 active:translate-y-1 transition-all">
            <Camera className="w-5 h-5 mr-2" />
            {homeContent.ctaPrimary}
          </Button>
          <Button onClick={() => router.push('/history')} size="lg" type="button" className="text-lg bg-white hover:bg-slate-50 text-slate-600 rounded-2xl shadow-sm border-2 border-slate-200 font-bold">
            {homeContent.ctaSecondary}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        {homeContent.values.map((value, index) => (
          <Card key={value} className="p-6 hover:-translate-y-2 hover:rotate-1 transition-transform duration-300 border-2 border-slate-100 rounded-3xl shadow-sm bg-white text-slate-600 flex flex-col items-center text-center gap-3">
            <p className="text-base font-bold text-center">{value}</p>
          </Card>
        ))}
      </section>

      <Card className="grid gap-4 p-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both border-4 border-white rounded-3xl shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-md">
        <div className="grid gap-2 text-center items-center">
          <h2 className="text-2xl font-heading font-bold text-slate-800">上传题目</h2>
          <p className="text-base text-slate-500">{homeContent.uploadHint}</p>
          <p className="text-sm text-slate-500/80">{homeContent.uploadTip}</p>
        </div>

        {previewUrl ? (
          <div className="grid gap-6 md:grid-cols-[280px_1fr] mt-4">
            <div className="relative group overflow-hidden border-4 border-white rounded-2xl shadow-md">
              <img
                alt="待识别题目预览"
                className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
                src={previewUrl}
              />
            </div>
            <div className="grid content-center gap-4">
              <p className="text-sm font-medium p-3 bg-sky-50 text-sky-700 border border-sky-100 rounded-2xl">
                {image?.name ?? '已选择题目图片，下一步会先识别并请你确认。'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button disabled={isExtracting || isStartingPreview} onClick={handleExtract} type="button" className="flex-1 sm:flex-none bg-emerald-400 hover:bg-emerald-300 text-emerald-950 rounded-2xl shadow-lg shadow-emerald-400/30 font-bold border-b-4 border-emerald-500 active:border-b-0 active:translate-y-1 transition-all">
                  {isExtracting ? '正在看这道题……' : '开始识别'}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  className="flex-1 sm:flex-none bg-white text-slate-500 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50"
                >
                  重新选择
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center p-12 border-4 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Camera className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-xl font-heading font-bold text-slate-800 mb-2">点击或拖拽上传</p>
            <p className="text-sm text-slate-500">支持 jpg, png 格式的图片</p>
          </div>
        )}

        {error ? <p className="text-sm font-bold text-destructive bg-destructive/10 p-3 rounded-2xl border border-destructive/20 mt-2">{error}</p> : null}
      </Card>

      <p className="text-sm font-medium text-slate-500/60 text-center animate-in fade-in duration-1000 delay-500 fill-mode-both">{homeContent.parentHint}</p>
    </main>
  );
}
