'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { PlaybackResumeState } from '@/lib/mistake/ui/playback-session-storage';

export type ResumeBannerProps = {
  variant: 'generation' | 'playback';
  state?: PlaybackResumeState | null;
  onResume: () => void;
  onDiscard: () => void;
  className?: string;
};

export function ResumeBanner({
  variant,
  state,
  onResume,
  onDiscard,
  className,
}: ResumeBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC = discard
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onDiscard]);

  if (!mounted) return null;

  const title =
    variant === 'generation'
      ? '上次还有未完成的生成任务'
      : state
        ? `上次观看到第 ${state.sceneIndex + 1} 页`
        : '上次还有未完成的播放任务';

  const description =
    variant === 'generation'
      ? '是否继续上次的大纲/内容生成？'
      : '是否从上次的位置继续观看？';

  return (
    <Alert
      variant="default"
      className={cn(
        'sticky top-0 z-50 border-amber-200 bg-amber-50 text-amber-900 shadow-md',
        'flex items-center justify-between gap-4',
        className,
      )}
      data-testid="resume-banner"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="size-5 shrink-0" />
        <div className="flex flex-col">
          <AlertTitle className="text-amber-900">{title}</AlertTitle>
          <AlertDescription className="text-amber-800">{description}</AlertDescription>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="default"
          onClick={onResume}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          继续
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} className="text-amber-900">
          <X className="size-3.5" />
          丢弃
        </Button>
      </div>
    </Alert>
  );
}
