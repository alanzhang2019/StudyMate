'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerationCountdownProps {
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Total number of active steps */
  totalSteps: number;
  /** Whether generation is currently active */
  isActive: boolean;
  /** Whether we're in the review phase */
  isReviewing?: boolean;
  /** Whether the first page has been generated */
  isFirstPageReady?: boolean;
  /** External start timestamp (ms). When provided, elapsed time is computed from this value instead of internal start */
  startTime?: number;
  /** Custom className */
  className?: string;
}

// Estimated time per step in seconds (based on Qwen3-8B performance)
// Total time until first page is ready
const STEP_TIME_ESTIMATES: Record<string, number> = {
  'pdf-analysis': 15,
  'web-search': 20,
  'outline': 60,
  'agent-generation': 25,
  'slide-content': 35,
  'actions': 25,
};

// Grace period after estimate expires before showing "still working"
const GRACE_PERIOD_SECONDS = 30;

function formatTime(seconds: number): string {
  if (seconds <= 0) return '即将完成';
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}分钟`;
  return `${minutes}分${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}秒`;
}

function computeTotalEstimate(totalSteps: number): number {
  const stepIds = Object.keys(STEP_TIME_ESTIMATES);
  let total = 0;
  for (let i = 0; i < totalSteps; i++) {
    const stepId = stepIds[i] || 'slide-content';
    total += STEP_TIME_ESTIMATES[stepId] || 30;
  }
  return total;
}

export function GenerationCountdown({
  currentStepIndex,
  totalSteps,
  isActive,
  isReviewing = false,
  isFirstPageReady = false,
  startTime,
  className,
}: GenerationCountdownProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(false);

  const totalEstimatedSeconds = useMemo(() => computeTotalEstimate(totalSteps), [totalSteps]);

  const updateElapsed = useCallback((effectiveStart: number) => {
    const elapsed = Math.floor((Date.now() - effectiveStart) / 1000);
    setElapsedSeconds(elapsed);
  }, []);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Start / stop timer based on isActive and startTime
  useEffect(() => {
    if (isActive && !isReviewing) {
      const effectiveStart = startTime && startTime > 0 ? startTime : Date.now();

      // Immediate update to reflect elapsed time since generation start
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Timer initialization requires immediate state sync
      updateElapsed(effectiveStart);

      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }
        updateElapsed(effectiveStart);
      }, 1000);
    }

    // Stop timer when first page is ready or generation is no longer active
    if ((isFirstPageReady || !isActive) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isReviewing, isFirstPageReady, startTime, updateElapsed]);

  // Reset when generation becomes inactive
  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset timer state when generation ends
      setElapsedSeconds(0);
    }
  }, [isActive]);

  const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
  const isOverdue = elapsedSeconds > totalEstimatedSeconds + GRACE_PERIOD_SECONDS;
  
  // Progress percent: cap at 95% until actually complete to avoid "stuck at 100%" feeling
  const progressPercent = totalEstimatedSeconds > 0
    ? Math.min(95, (elapsedSeconds / totalEstimatedSeconds) * 100)
    : 0;

  // Determine display text
  const getDisplayText = () => {
    if (isFirstPageReady) return '课件准备就绪';
    if (isOverdue) return '仍在努力生成中...';
    if (remainingSeconds <= 0) return '即将完成';
    return formatTime(remainingSeconds);
  };

  // Determine subtext
  const getSubText = () => {
    if (isFirstPageReady) return '首页已生成';
    if (isOverdue) return '请耐心等待，正在处理中';
    return '预计剩余时间';
  };

  // Don't show if not active or in review
  if (!isActive || isReviewing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'relative flex flex-col items-center gap-3',
        className,
      )}
    >
      {/* Main countdown display */}
      <div className={cn(
        "relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-blue-500/20 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm",
        isOverdue && "from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/20 dark:via-orange-500/20 dark:to-amber-500/20 border-amber-200/50 dark:border-amber-800/50"
      )}>
        {/* Pulsing clock icon */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {isOverdue ? (
            <Loader2 className="size-5 text-amber-500 dark:text-amber-400 animate-spin" />
          ) : (
            <Clock className={cn(
              "size-5",
              isOverdue ? "text-amber-500 dark:text-amber-400" : "text-blue-500 dark:text-blue-400"
            )} />
          )}
        </motion.div>

        {/* Time display */}
        <div className="flex flex-col items-start">
          <span className="text-xs text-muted-foreground font-medium">
            {getSubText()}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={getDisplayText()}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className={cn(
                "text-lg font-bold tabular-nums",
                isOverdue 
                  ? "text-amber-600 dark:text-amber-400" 
                  : "text-blue-600 dark:text-blue-400"
              )}
            >
              {getDisplayText()}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Speed indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20"
        >
          <Zap className="size-3 text-green-500" />
          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
            Qwen3-8B
          </span>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="w-64 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            isOverdue 
              ? "from-amber-500 via-orange-500 to-amber-400" 
              : "from-blue-500 via-purple-500 to-blue-400"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              idx < currentStepIndex
                ? 'w-6 bg-blue-500'
                : idx === currentStepIndex
                  ? 'w-6 bg-blue-300 animate-pulse'
                  : 'w-1.5 bg-slate-200 dark:bg-slate-700',
            )}
          />
        ))}
      </div>
    </motion.div>
  );
}
