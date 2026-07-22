'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { Whiteboard } from '@/components/whiteboard';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { shouldShowCanvasPlayHint } from '@/lib/canvas/play-hint-visibility';
import type { CanvasToolbarProps } from '@/components/canvas/canvas-toolbar';
import type { Scene, StageMode } from '@/lib/types/stage';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ClassroomCompletePageConnected } from '@/components/scene-renderers/classroom-complete';
import { sendDebugEvent } from '@/lib/utils/debug-event';
import { useGenerationProgress, getPhaseText } from '@/lib/hooks/use-generation-progress';
import { savePlaybackSession } from '@/lib/mistake/ui/playback-session-storage';
import { useStageStore } from '@/lib/store/stage';

interface CanvasAreaProps extends CanvasToolbarProps {
  readonly currentScene: Scene | null;
  readonly mode: StageMode;
  readonly hideToolbar?: boolean;
  readonly isPendingScene?: boolean;
  readonly isCourseComplete?: boolean;
  readonly isGenerationFailed?: boolean;
  readonly generationFailureReason?: string | null;
  readonly onRetryGeneration?: () => void;
  readonly hasVisibleLectureContent?: boolean;
  readonly whiteboardEnabled?: boolean;
  readonly isAutoStarting?: boolean;
}

export function CanvasArea({
  currentScene,
  currentSceneIndex,
  scenesCount,
  mode,
  engineState,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  isPresenting,
  onTogglePresentation,
  showStopDiscussion,
  onStopDiscussion,
  hideToolbar,
  isPendingScene,
  isCourseComplete,
  isGenerationFailed,
  generationFailureReason,
  onRetryGeneration,
  hasVisibleLectureContent = false,
  whiteboardEnabled = true,
  isAutoStarting = false,
}: CanvasAreaProps) {
  const { t } = useI18n();
  const stageId = useStageStore((s) => s.stage?.id ?? null);
  const isPlaying = engineState === 'playing';
  const showControls = mode === 'playback' && !whiteboardOpen;
  const showPlayHint = shouldShowCanvasPlayHint({
    showControls,
    engineState,
    sceneType: currentScene?.type,
    isLiveSession: isLiveSession ?? false,
    isPendingScene: Boolean(isPendingScene),
    hasVisibleLectureContent,
    isAutoStarting,
  });

  useEffect(() => {
    // #region debug-point E:canvas-visibility
    sendDebugEvent({
      sessionId: 'mistake-classroom-regression',
      runId: 'pre',
      hypothesisId: 'E',
      location: 'components/canvas/canvas-area.tsx:68',
      msg: '[DEBUG] canvas visibility snapshot',
      data: {
        currentSceneId: currentScene?.id ?? null,
        currentSceneType: currentScene?.type ?? null,
        showPlayHint,
        whiteboardOpen,
        whiteboardEnabled,
        isPendingScene: Boolean(isPendingScene),
        isCourseComplete: Boolean(isCourseComplete),
        isGenerationFailed: Boolean(isGenerationFailed),
        hasVisibleLectureContent,
        isAutoStarting,
        isLiveSession,
        engineState,
      },
    });
    // #endregion
  }, [
    currentScene?.id,
    currentScene?.type,
    engineState,
    hasVisibleLectureContent,
    isCourseComplete,
    isGenerationFailed,
    isLiveSession,
    isPendingScene,
    isAutoStarting,
    showPlayHint,
    whiteboardEnabled,
    whiteboardOpen,
  ]);

  // Throttled playback save: persist current scene position for resume banner.
  // Only save for slide scenes (avoid mid-quiz or mid-interactive interruption).
  // We must skip the very first scene we see AND not save when the effect re-runs
  // for unrelated reasons (e.g. engineState prop changing). Otherwise a refresh
  // would silently overwrite the saved session with the default first scene.
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstSaveRunRef = useRef(true);
  const lastSavedSceneIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!stageId || !currentScene) return;
    if (currentScene.type !== 'slide') return;
    if (typeof currentSceneIndex !== 'number') return;

    if (isFirstSaveRunRef.current) {
      isFirstSaveRunRef.current = false;
      lastSavedSceneIdRef.current = currentScene.id;
      return;
    }

    if (lastSavedSceneIdRef.current === currentScene.id) return;
    lastSavedSceneIdRef.current = currentScene.id;

    if (saveThrottleRef.current) {
      clearTimeout(saveThrottleRef.current);
    }
    saveThrottleRef.current = setTimeout(() => {
      savePlaybackSession({
        classroomId: stageId,
        sceneId: currentScene.id,
        sceneIndex: currentSceneIndex,
        isPlaying,
        savedAt: Date.now(),
      });
    }, 500);

    return () => {
      if (saveThrottleRef.current) {
        clearTimeout(saveThrottleRef.current);
        saveThrottleRef.current = null;
      }
    };
  }, [stageId, currentScene?.id, currentScene?.type, currentSceneIndex, isPlaying]);

  const handleSlideClick = useCallback(
    (e: React.MouseEvent) => {
      if (!showControls || isLiveSession || currentScene?.type !== 'slide') return;
      // Don't trigger page play/pause when clicking inside a video element's visual area.
      // Video elements may be visually covered by other slide elements (e.g. text),
      // so we check click coordinates against all video element bounding rects.
      const container = e.currentTarget as HTMLElement;
      const videoEls = container.querySelectorAll('[data-video-element]');
      for (const el of videoEls) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      onPlayPause();
    },
    [showControls, isLiveSession, onPlayPause, currentScene?.type],
  );

  // ── Letterbox the slide at 16:9 inside the available canvas area ──
  // The CSS `aspect-[16/9] w-full max-h-full` shortcut only works when
  // the parent is taller than 16:9 (height-driven). In a wide parent
  // (e.g. chat sidebar visible) the slide gets squeezed horizontally
  // and leaves a lot of empty space at the bottom. Compute the
  // largest 16:9 box that fits the parent in both dimensions and
  // apply it as inline styles. useLayoutEffect runs before paint so
  // there's no visible flash on mount.
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [slideDims, setSlideDims] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;
    const TARGET_RATIO = 16 / 9;
    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0) {
        setSlideDims(null);
        return;
      }
      if (cw / ch > TARGET_RATIO) {
        // Container is wider than 16:9 → height is the limiting dim
        setSlideDims({ width: ch * TARGET_RATIO, height: ch });
      } else {
        // Container is taller (or equal) than 16:9 → width is the limiting dim
        setSlideDims({ width: cw, height: cw / TARGET_RATIO });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={cn(
      'w-full flex-1 min-h-0 flex flex-col bg-gray-50 dark:bg-gray-900 group/canvas',
    )}>
      {/* Slide area — fills remaining space above the toolbar */}
      <div
        className={cn(
          'relative overflow-hidden flex flex-col p-2 transition-colors duration-500 min-h-0',
          currentScene?.type === 'interactive'
            ? 'flex-1 bg-blue-100/50 dark:bg-blue-950/20'
            : 'flex-1 bg-slate-200/95 dark:bg-slate-950/70',
        )}
      >
        {/* Inner container — flex-1 so aspect-ratio slide can center inside */}
        <div
          ref={slideContainerRef}
          className="flex-1 min-h-0 flex items-center justify-center"
        >
          <div
            className={cn(
              'bg-white dark:bg-gray-800 shadow-2xl rounded-lg relative transition-all duration-700 border-2 border-slate-400 dark:border-slate-600',
              currentScene?.type === 'interactive'
              ? 'overflow-hidden shadow-blue-200/60 dark:shadow-blue-900/50 ring-2 ring-blue-300/40 dark:ring-blue-500/20'
              : 'overflow-hidden shadow-slate-400/60 dark:shadow-slate-950/70 ring-2 ring-white/80 dark:ring-slate-800/90',
              showControls && !isLiveSession && currentScene?.type === 'slide' && 'cursor-pointer',
            )}
            style={slideDims
              ? { width: `${slideDims.width}px`, height: `${slideDims.height}px` }
              : { visibility: 'hidden' }}
            onClick={handleSlideClick}
          >
          {/* Whiteboard Layer */}
          <div className="absolute inset-0 z-[110] pointer-events-none">
            <SceneProvider>
              <Whiteboard isOpen={whiteboardOpen} onClose={onWhiteboardClose} />
            </SceneProvider>
          </div>

          {/* Scene Content */}
          {currentScene && !whiteboardOpen && (
            <div className={cn(
              'w-full h-full',
              'absolute inset-0 overflow-hidden'
            )}>
              <SceneProvider>
                <SceneRenderer scene={currentScene} mode={mode} />
              </SceneProvider>
            </div>
          )}

          {/* Pending Scene Loading / Completion Overlay */}
          <AnimatePresence>
            {isPendingScene && !currentScene && isCourseComplete && (
              <motion.div
                key="course-complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <ClassroomCompletePageConnected />
              </motion.div>
            )}
            {isPendingScene && !currentScene && !isCourseComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute inset-0 z-[105] flex flex-col items-center justify-center bg-white dark:bg-gray-800"
              >
                {isGenerationFailed ? (
                  <div className="flex flex-col items-center gap-3 max-w-md px-6">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-red-400 dark:text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm text-red-500 dark:text-red-400 font-medium">
                      {t('stage.generationFailed')}
                    </span>
                    {generationFailureReason && (
                      <p
                        className="text-xs text-slate-500 dark:text-slate-400 text-center break-words max-w-sm"
                        title={generationFailureReason}
                      >
                        {generationFailureReason}
                      </p>
                    )}
                    {onRetryGeneration && (
                      <button
                        onClick={onRetryGeneration}
                        className="mt-1 px-4 py-1.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95"
                      >
                        {t('generation.retryScene')}
                      </button>
                    )}
                  </div>
                ) : (
                  <GenerationProgressView />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scene Number Badge */}
          {currentScene && (
            <div className="absolute top-4 right-4 text-gray-200 dark:text-gray-700 font-black text-4xl opacity-50 pointer-events-none select-none mix-blend-multiply dark:mix-blend-screen">
              {(currentSceneIndex + 1).toString().padStart(2, '0')}
            </div>
          )}

          {/* Play hint — breathing button when idle or paused (slides only) */}
          <AnimatePresence>
            {showPlayHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-[102] flex items-center justify-center pointer-events-none"
              >
                <motion.div
                  className="opacity-50 group-hover/canvas:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                  exit={{ pointerEvents: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPause();
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: [1, 1.06] }}
                    exit={{ scale: 1.15, opacity: 0 }}
                    transition={{
                      default: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                      scale: {
                        repeat: Infinity,
                        repeatType: 'mirror',
                        duration: 1,
                        ease: 'easeInOut',
                      },
                    }}
                    className="w-20 h-20 rounded-full bg-white/95 dark:bg-gray-800/95 flex items-center justify-center shadow-[0_4px_30px_rgba(147,51,234,0.15),inset_0_0_0_1px_rgba(233,213,255,0.5)] dark:shadow-[0_4px_30px_rgba(147,51,234,0.3),inset_0_0_0_1px_rgba(126,34,206,0.3)]"
                    style={{ willChange: 'transform' }}
                  >
                    <Play className="w-7 h-7 text-purple-600 dark:text-purple-400 fill-purple-600/90 dark:fill-purple-400/90 ml-0.5" />
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      {/* ── Canvas Toolbar — in document flow, only when not merged into roundtable ── */}
      {!hideToolbar && (
        <CanvasToolbar
          className={cn(
            'shrink-0 h-9 px-2',
            'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl',
            'border-t border-gray-200/40 dark:border-gray-700/40',
          )}
          currentSceneIndex={currentSceneIndex}
          scenesCount={scenesCount}
          engineState={engineState}
          isLiveSession={isLiveSession}
          whiteboardOpen={whiteboardOpen}
          sidebarCollapsed={sidebarCollapsed}
          chatCollapsed={chatCollapsed}
          onToggleSidebar={onToggleSidebar}
          onToggleChat={onToggleChat}
          onPrevSlide={onPrevSlide}
          onNextSlide={onNextSlide}
          onPlayPause={onPlayPause}
          onWhiteboardClose={onWhiteboardClose}
          whiteboardEnabled={whiteboardEnabled}
          isPresenting={isPresenting}
          onTogglePresentation={onTogglePresentation}
          showStopDiscussion={showStopDiscussion}
          onStopDiscussion={onStopDiscussion}
          isAutoStarting={isAutoStarting}
        />
      )}
    </div>
  );
}

/**
 * Generation progress view with countdown timer
 */
function GenerationProgressView() {
  const progress = useGenerationProgress();

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Spinner with progress ring */}
      <div className="relative w-16 h-16">
        {/* Background ring */}
        <div className="absolute inset-0 rounded-full border-3 border-gray-100 dark:border-gray-700" />
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-purple-500 dark:text-purple-400"
            strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * (1 - (progress.completedScenes / Math.max(1, progress.totalScenes)))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        {/* Spinner */}
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-purple-500 dark:border-t-purple-400 animate-spin" />
      </div>

      {/* Progress text */}
      <div className="flex flex-col items-center gap-2">
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-base text-gray-700 dark:text-gray-300 font-semibold"
        >
          正在生成第 {progress.currentScene} / {progress.totalScenes} 页
        </motion.span>

        {/* Phase indicator */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="text-xs text-purple-500 dark:text-purple-400 font-medium px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20"
        >
          {getPhaseText(progress.currentPhase)}
        </motion.span>

        {/* Generation status hint */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="text-sm text-gray-400 dark:text-gray-500 font-medium"
        >
          后台生成中，可继续浏览
        </motion.span>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 dark:from-purple-400 dark:to-purple-300 rounded-full"
          initial={{ width: 0 }}
          animate={{
            width: `${(progress.completedScenes / Math.max(1, progress.totalScenes)) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
