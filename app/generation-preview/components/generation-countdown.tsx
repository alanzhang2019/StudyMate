'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap } from 'lucide-react';
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
  /** Custom className */
  className?: string;
}

// Estimated time per step in seconds (based on Qwen3-8B performance)
// Total time until first page is ready
const STEP_TIME_ESTIMATES: Record<string, number> = {
  'pdf-analysis': 15,
  'web-search': 20,
  'outline': 45,
  'agent-generation': 25,
  'slide-content': 35,
  'actions': 25,
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return '即将完成';
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}分钟`;
  return `${minutes}分${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}秒`;
}

export function GenerationCountdown({
  currentStepIndex,
  totalSteps,
  isActive,
  isReviewing = false,
  isFirstPageReady = false,
  className,
}: GenerationCountdownProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(false);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate total estimated time based on current configuration
  // Only count steps up to first page generation (slide-content + actions)
  useEffect(() => {
    const stepIds = Object.keys(STEP_TIME_ESTIMATES);
    let total = 0;

    // Add time for each active step until first page is ready
    for (let i = 0; i < totalSteps; i++) {
      const stepId = stepIds[i] || 'slide-content';
      total += STEP_TIME_ESTIMATES[stepId] || 30;
    }

    setTotalEstimatedSeconds(total);
  }, [totalSteps]);

  // Start timer only once when generation becomes active
  useEffect(() => {
    if (isActive && !isReviewing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          // Clear interval if component is unmounted
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
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
  }, [isActive, isReviewing, isFirstPageReady]);

  // Reset when generation starts completely fresh (page reload or new generation)
  useEffect(() => {
    if (!isActive) {
      hasStartedRef.current = false;
      startTimeRef.current = 0;
      setElapsedSeconds(0);
    }
  }, [isActive]);

  const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
  const progressPercent = totalEstimatedSeconds > 0
    ? Math.min(100, (elapsedSeconds / totalEstimatedSeconds) * 100)
    : 0;

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
      <div className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-blue-500/20 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm">
        {/* Pulsing clock icon */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Clock className="size-5 text-blue-500 dark:text-blue-400" />
        </motion.div>

        {/* Time display */}
        <div className="flex flex-col items-start">
          <span className="text-xs text-muted-foreground font-medium">
            {isFirstPageReady ? '首页已生成' : '预计剩余时间'}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={remainingSeconds}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums"
            >
              {isFirstPageReady ? '课件准备就绪' : formatTime(remainingSeconds)}
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
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <motion.div
            key={idx}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              idx < currentStepIndex
                ? 'w-1.5 bg-blue-500/40'
                : idx === currentStepIndex
                  ? 'w-6 bg-blue-500'
                  : 'w-1.5 bg-slate-200 dark:bg-slate-700',
            )}
            animate={idx === currentStepIndex ? {
              opacity: [1, 0.5, 1],
            } : {}}
            transition={idx === currentStepIndex ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            } : {}}
          />
        ))}
      </div>
    </motion.div>
  );
}
