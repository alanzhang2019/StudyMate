'use client';

import { HomeworkResultShell } from '@/components/mistake/homework-result-shell';
import { Stage } from '@/components/stage';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { needsServerAudioHydration } from '@/lib/mistake/ui/classroom-audio-hydration';
import { resetCanvasForClassroomPlayback } from '@/lib/mistake/ui/classroom-canvas-reset';
import {
  parseStoredClassroomGenerationParams,
  shouldDiscardPersistedClassroomOutlines,
  shouldResumeClassroomGeneration,
} from '@/lib/mistake/ui/classroom-generation-resume';
import {
  getClassroomLoadState,
  shouldCommitClassroomLoadUpdate,
  shouldResetClassroomLoading,
  shouldShowClassroomLoadingOverlay,
  shouldUnblockClassroomDisplay,
} from '@/lib/mistake/ui/classroom-load-state';
import { useStageStore } from '@/lib/store';
import { loadImageMapping } from '@/lib/utils/image-storage';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSceneGenerator } from '@/lib/hooks/use-scene-generator';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { createLogger } from '@/lib/logger';
import { sendDebugEvent } from '@/lib/utils/debug-event';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { generateMediaForOutlines } from '@/lib/media/media-orchestrator';
import { updateMistakeSession } from '@/lib/mistake/session/client';
import type { MistakeSession } from '@/lib/mistake/session/types';
import { AlertCircle } from 'lucide-react';

const log = createLogger('Classroom');

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params?.id as string;

  const { loadFromStorage } = useStageStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mistakeSessionId, setMistakeSessionId] = useState<string | null>(null);
  // No longer used in this mode
  // const [lectureCompleted, setLectureCompleted] = useState(false);
  const stageName = useStageStore((s) => s.stage?.name ?? '');

  const generationStartedRef = useRef(false);
  const loadLifecycleIdRef = useRef(0);

  const { generateRemaining, retrySingleOutline, stop } = useSceneGenerator({
    onComplete: async () => {
      log.info('[Classroom] All scenes generated');

      try {
        const genParamsStr = sessionStorage.getItem('generationParams');
        const params = genParamsStr ? (JSON.parse(genParamsStr) as { mistakeSessionId?: string }) : null;

        if (params?.mistakeSessionId) {
          await updateMistakeSession(params.mistakeSessionId, {
            classroomId,
            status: 'completed',
            error: '',
          });
        }
      } catch (err) {
        log.warn('[Classroom] Failed to mark mistake session completed:', err);
      }
    },
  });

  const loadClassroom = useCallback(async (isCancelled?: () => boolean) => {
    try {
      let indexedDbHit = false;
      let serverHit = false;
      const generationParams = parseStoredClassroomGenerationParams(
        sessionStorage.getItem('generationParams'),
      );

      await loadFromStorage(classroomId, { force: true });
      if (!shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
        return;
      }
      indexedDbHit = Boolean(
        useStageStore.getState().stage?.id === classroomId && useStageStore.getState().scenes.length > 0,
      );
      // #region debug-point D:after-storage-load
      sendDebugEvent({
        sessionId: 'mistake-classroom-regression',
        runId: 'pre',
        hypothesisId: 'D',
        location: 'app/classroom/[id]/page.tsx:67',
        msg: '[DEBUG] classroom load after storage',
        data: {
          classroomId,
          indexedDbHit,
          stageId: useStageStore.getState().stage?.id ?? null,
          stageName: useStageStore.getState().stage?.name ?? null,
          scenesLength: useStageStore.getState().scenes.length,
          currentSceneId: useStageStore.getState().currentSceneId ?? null,
        },
      });
      // #endregion
      const missingServerAudio =
        indexedDbHit && needsServerAudioHydration(useStageStore.getState().scenes);

      // If IndexedDB had no data or only has a stale classroom without audioUrl,
      // try server-side storage to hydrate a browser-portable version.
      if (!useStageStore.getState().stage || missingServerAudio) {
        log.info(
          !useStageStore.getState().stage
            ? 'No IndexedDB data, trying server-side storage for:'
            : 'IndexedDB classroom missing audioUrl, rehydrating from server for:',
          classroomId,
        );
        try {
          const res = await fetch(`/api/classroom?id=${encodeURIComponent(classroomId)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.classroom) {
              const { stage, scenes } = json.classroom;
              useStageStore.getState().replaceStageSnapshot({
                stage,
                scenes,
                currentSceneId: scenes[0]?.id ?? null,
                chats: [],
              });
              serverHit = true;
              // #region debug-point D:server-hydration
              sendDebugEvent({
                sessionId: 'mistake-classroom-regression',
                runId: 'pre',
                hypothesisId: 'D',
                location: 'app/classroom/[id]/page.tsx:94',
                msg: '[DEBUG] classroom load after server hydration',
                data: {
                  classroomId,
                  stageId: stage?.id ?? null,
                  stageName: stage?.name ?? null,
                  scenesLength: scenes.length,
                  firstSceneId: scenes[0]?.id ?? null,
                  firstSceneType: scenes[0]?.type ?? null,
                },
              });
              // #endregion
              log.info('Loaded from server-side storage:', classroomId);

              // Hydrate server-generated agents into IndexedDB + registry.
              // Don't set selectedAgentIds here — the general agent
              // restoration logic below (Path 2) handles it uniformly.
              if (stage.generatedAgentConfigs?.length) {
                const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
                await saveGeneratedAgents(stage.id, stage.generatedAgentConfigs);
                log.info('Hydrated server-generated agents for stage:', stage.id);
              }
            }
          }
        } catch (fetchErr) {
          log.warn('Server-side storage fetch failed:', fetchErr);
        }
      }
      if (!shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
        return;
      }

      const loadState = getClassroomLoadState({
        indexedDbHit,
        serverHit,
        classroomId,
      });

      if (loadState.kind === 'not_found') {
        // #region debug-point D:not-found
        sendDebugEvent({
          sessionId: 'mistake-classroom-regression',
          runId: 'pre',
          hypothesisId: 'D',
          location: 'app/classroom/[id]/page.tsx:118',
          msg: '[DEBUG] classroom load not found',
          data: {
            classroomId,
            indexedDbHit,
            serverHit,
            message: loadState.message,
          },
        });
        // #endregion
        if (shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
          setError(loadState.message);
        }
        return;
      }

      // #region debug-point D:ready-state
      sendDebugEvent({
        sessionId: 'mistake-classroom-regression',
        runId: 'pre',
        hypothesisId: 'D',
        location: 'app/classroom/[id]/page.tsx:122',
        msg: '[DEBUG] classroom load ready state',
        data: {
          classroomId,
          indexedDbHit,
          serverHit,
          stageId: useStageStore.getState().stage?.id ?? null,
          stageName: useStageStore.getState().stage?.name ?? null,
          scenesLength: useStageStore.getState().scenes.length,
          currentSceneId: useStageStore.getState().currentSceneId ?? null,
        },
      });
      // #endregion

      const currentState = useStageStore.getState();
      if (
        shouldDiscardPersistedClassroomOutlines({
          generationParams,
          scenesLength: currentState.scenes.length,
          outlinesLength: currentState.outlines.length,
        })
      ) {
        useStageStore.setState({
          outlines: [],
          generatingOutlines: [],
        });
        const { db } = await import('@/lib/utils/database');
        await db.stageOutlines.delete(classroomId);
        log.info('[Classroom] Discarded stale persisted outlines without preview handoff:', {
          classroomId,
          scenesLength: currentState.scenes.length,
          outlinesLength: currentState.outlines.length,
        });
      }

      const classroomState = useStageStore.getState();
      if (
        shouldUnblockClassroomDisplay({
          loadStateKind: loadState.kind,
          stageId: classroomState.stage?.id ?? null,
          scenesLength: classroomState.scenes.length,
        })
        && shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })
      ) {
        setLoading(false);
      }

      // Restore completed media generation tasks from IndexedDB
      try {
        await useMediaGenerationStore.getState().restoreFromDB(classroomId);
      } catch (restoreError) {
        log.warn('[Classroom] Failed to restore media generation tasks:', restoreError);
      }
      if (!shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
        return;
      }
      // Restore agents for this stage
      try {
        const { loadGeneratedAgentsForStage, useAgentRegistry } =
          await import('@/lib/orchestration/registry/store');
        const generatedAgentIds = await loadGeneratedAgentsForStage(classroomId);
        const { useSettingsStore } = await import('@/lib/store/settings');
        if (generatedAgentIds.length > 0) {
          // Auto mode — use generated agents from IndexedDB
          useSettingsStore.getState().setAgentMode('auto');
          useSettingsStore.getState().setSelectedAgentIds(generatedAgentIds);
        } else {
          // Preset mode — restore agent IDs saved in the stage at creation time.
          // Filter out any stale generated IDs that may have been persisted before
          // the bleed-fix, so they don't resolve against a leftover registry entry.
          const stage = useStageStore.getState().stage;
          const stageAgentIds = stage?.agentIds;
          const registry = useAgentRegistry.getState();
          const cleanIds = stageAgentIds?.filter((id) => {
            const a = registry.getAgent(id);
            return a && !a.isGenerated;
          });
          useSettingsStore.getState().setAgentMode('preset');
          useSettingsStore
            .getState()
            .setSelectedAgentIds(
              cleanIds && cleanIds.length > 0 ? cleanIds : ['default-1', 'default-2', 'default-3'],
            );
        }
      } catch (agentRestoreError) {
        log.warn('[Classroom] Failed to restore classroom agents:', agentRestoreError);
      }
    } catch (error) {
      log.error('Failed to load classroom:', error);
      if (shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
        setError(error instanceof Error ? error.message : 'Failed to load classroom');
      }
    } finally {
      // #region debug-point C:classroom-load-finally
      sendDebugEvent({
        sessionId: 'classroom-needs-refresh',
        runId: 'pre',
        hypothesisId: 'C',
        location: 'app/classroom/[id]/page.tsx:294',
        msg: '[DEBUG] classroom load lifecycle finally',
        data: {
          classroomId,
          stageId: useStageStore.getState().stage?.id ?? null,
          scenesLength: useStageStore.getState().scenes.length,
        },
      });
      // #endregion
      if (shouldCommitClassroomLoadUpdate({ cancelled: Boolean(isCancelled?.()) })) {
        setLoading(false);
      }
    }
  }, [classroomId, loadFromStorage]);

  useEffect(() => {
    let cancelled = false;

    const loadMistakeSummary = async (sessionId: string) => {
      try {
        const response = await fetch(`/api/mistake/session/${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as { session?: MistakeSession };
        const session = json.session;
        if (!session || cancelled) {
          return;
        }

        const summary = session.explanationSummary || null;

        if (!session.explanationSummary || !session.masteryStatus) {
          await updateMistakeSession(sessionId, {
            explanationSummary: summary,
            masteryStatus: session.masteryStatus ?? 'pending',
          });
        }
      } catch (summaryError) {
        log.warn('[Classroom] Failed to load mistake summary:', summaryError);
      }
    };

    const loadMistakeContext = async () => {
      try {
        const genParamsStr = sessionStorage.getItem('generationParams');
        const params = genParamsStr
          ? (JSON.parse(genParamsStr) as { mistakeSessionId?: string })
          : null;

        let sessionId = params?.mistakeSessionId ?? null;

        if (!sessionId) {
          const response = await fetch(
            `/api/mistake/session/by-classroom?classroomId=${encodeURIComponent(classroomId)}`,
          );
          if (response.ok) {
            const json = (await response.json()) as { session?: MistakeSession };
            sessionId = json.session?.id ?? null;
          }
        }

        if (cancelled) {
          return;
        }

        setMistakeSessionId(sessionId);

        if (!sessionId) {
          // setMistakeSummary(null);
          return;
        }

        await loadMistakeSummary(sessionId);
      } catch (summaryError) {
        log.warn('[Classroom] Failed to resolve mistake session:', summaryError);
      }
    };

    void loadMistakeContext();

    return () => {
      cancelled = true;
    };
  }, [classroomId]);

  useEffect(() => {
    // #region debug-point B:classroom-visibility
    sendDebugEvent({
      sessionId: 'classroom-needs-refresh',
      runId: 'pre',
      hypothesisId: 'B',
      location: 'app/classroom/[id]/page.tsx:330',
      msg: '[DEBUG] classroom visibility snapshot',
      data: {
        classroomId,
        loading,
        error,
        mistakeSessionId,
        stageId: useStageStore.getState().stage?.id ?? null,
        scenesLength: useStageStore.getState().scenes.length,
        currentSceneId: useStageStore.getState().currentSceneId ?? null,
        hasGenerationParams: Boolean(sessionStorage.getItem('generationParams')),
      },
    });
    // #endregion
  }, [classroomId, error, loading, mistakeSessionId]);

  useEffect(() => {
    const lifecycleId = `${classroomId}-${Date.now()}-${++loadLifecycleIdRef.current}`;
    let cancelled = false;
    // #region debug-point C:classroom-load-start
    sendDebugEvent({
      sessionId: 'classroom-needs-refresh',
      runId: 'pre',
      hypothesisId: 'C',
      location: 'app/classroom/[id]/page.tsx:356',
      msg: '[DEBUG] classroom load lifecycle start',
      data: {
        lifecycleId,
        classroomId,
      },
    });
    // #endregion

    // Reset loading state on course switch to unmount Stage during transition,
    // preventing stale data from syncing back to the new course
    const currentStageState = useStageStore.getState();
    if (
      shouldResetClassroomLoading({
        classroomId,
        currentStageId: currentStageState.stage?.id ?? null,
        scenesLength: currentStageState.scenes.length,
      })
    ) {
      setLoading(true);
    }
    setError(null);
    // setLectureCompleted(false);
    resetCanvasForClassroomPlayback();
    generationStartedRef.current = false;

    // Clear previous classroom's media tasks to prevent cross-classroom contamination.
    // Placeholder IDs (gen_img_1, gen_vid_1) are NOT globally unique across stages,
    // so stale tasks from a previous classroom would shadow the new one's.
    const mediaStore = useMediaGenerationStore.getState();
    mediaStore.revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    // Clear whiteboard history to prevent snapshots from a previous course leaking in.
    useWhiteboardHistoryStore.getState().clearHistory();

    loadClassroom(() => cancelled);

    // Cancel ongoing generation when classroomId changes or component unmounts
    return () => {
      cancelled = true;
      // #region debug-point C:classroom-load-cleanup
      sendDebugEvent({
        sessionId: 'classroom-needs-refresh',
        runId: 'pre',
        hypothesisId: 'C',
        location: 'app/classroom/[id]/page.tsx:376',
        msg: '[DEBUG] classroom load lifecycle cleanup',
        data: {
          lifecycleId,
          classroomId,
        },
      });
      // #endregion
      stop();
    };
  }, [classroomId, loadClassroom, stop]);

  // Auto-resume generation for pending outlines
  useEffect(() => {
    if (loading || error || generationStartedRef.current) return;

    const state = useStageStore.getState();
    const { outlines, scenes, stage } = state;

    // Check if there are pending outlines
    const completedOrders = new Set(scenes.map((s) => s.order));
    const hasPending = outlines.some((o) => !completedOrders.has(o.order));
    const generationParams = parseStoredClassroomGenerationParams(
      sessionStorage.getItem('generationParams'),
    );

    if (
      shouldResumeClassroomGeneration({
        hasPendingOutlines: hasPending,
        generationParams,
      }) &&
      stage
    ) {
      generationStartedRef.current = true;

      // Reconstruct imageMapping from IndexedDB using pdfImages storageIds
      const storageIds = ((generationParams?.pdfImages || []) as any[])
        .map((img: { storageId?: string }) => img.storageId)
        .filter(Boolean) as string[];

      // Start generation in background without blocking the UI
      loadImageMapping(storageIds).then((imageMapping) => {
        // Use setTimeout to ensure this doesn't block the render cycle
        setTimeout(() => {
          generateRemaining({
            pdfImages: generationParams?.pdfImages as any,
            imageMapping,
            stageInfo: {
              name: stage.name || '',
              description: stage.description,
              style: stage.style,
            },
            agents: generationParams?.agents as any,
            userProfile: generationParams?.userProfile as any,
            languageDirective: generationParams?.languageDirective || stage.languageDirective,
          });
        }, 100);
      });
    } else if (!hasPending && outlines.length > 0 && stage) {
      // All scenes are generated, but some media may not have finished.
      // Resume media generation for any tasks not yet in IndexedDB.
      // generateMediaForOutlines skips already-completed tasks automatically.
      generationStartedRef.current = true;
      generateMediaForOutlines(outlines, stage.id).catch((err) => {
        log.warn('[Classroom] Media generation resume error:', err);
      });
    }
  }, [loading, error, generateRemaining]);

  const showLoadingOverlay = shouldShowClassroomLoadingOverlay({
    loading,
    classroomId,
    currentStageId: useStageStore.getState().stage?.id ?? null,
    scenesLength: useStageStore.getState().scenes.length,
  });

  useEffect(() => {
    // We intentionally ignore defaultPresentation here so it acts like open.maic.chat
    return;
  }, []);

  return (
    <ThemeProvider>
      <MediaStageProvider value={classroomId}>
        <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          {/* Decorative background */}
          {showLoadingOverlay && (
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
              <div className="absolute top-1/3 -left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
            </div>
          )}
          
          {showLoadingOverlay ? (
            <div className="flex-1 flex items-center justify-center bg-transparent relative z-10">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl shadow-lg flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
                <p className="text-xl font-medium text-slate-700">Loading classroom...</p>
                <p className="text-sm text-slate-500 mt-2">Preparing your AI tutoring experience</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center bg-transparent relative z-10">
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-2xl shadow-lg flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-xl font-medium text-slate-800 mb-2">Something went wrong</p>
                <p className="text-slate-600 mb-6">Error: {error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    loadClassroom();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            (() => {
              const stageNode = (
                <Stage
                  defaultPresentation={false}
                  autoPlay={true}
                  onLectureComplete={() => {}}
                  onRetryOutline={retrySingleOutline}
                />
              );

              return stageNode;
            })()
          )}
        </div>
      </MediaStageProvider>
    </ThemeProvider>
  );
}
