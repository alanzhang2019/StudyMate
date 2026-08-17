'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { useStageStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import { SceneSidebar } from './stage/scene-sidebar';
import { Header } from './header';
import { CanvasArea } from '@/components/canvas/canvas-area';
import { Roundtable } from '@/components/roundtable';
import { PlaybackEngine, computePlaybackView } from '@/lib/playback';
import type { EngineMode, TriggerEvent, Effect } from '@/lib/playback';
import { ActionEngine } from '@/lib/action/engine';
import { createAudioPlayer } from '@/lib/utils/audio-player';
import { useDiscussionTTS } from '@/lib/hooks/use-discussion-tts';
import { useCspProgress } from '@/lib/hooks/use-csp-progress';
import { useWidgetIframeStore } from '@/lib/store/widget-iframe';
import { FULL_PAPER_CLASSROOM_IDS } from '@/components/scene-renderers/quiz-view';
import type { AudioIndicatorState } from '@/components/roundtable/audio-indicator';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { getNextHomeworkPresentationState } from '@/lib/mistake/ui/homework-presentation-state';
import {
  getNextHomeworkWhiteboardOpenState,
  shouldEnableHomeworkWhiteboard,
} from '@/lib/mistake/ui/homework-whiteboard-guard';
// Playback state persistence removed — refresh always starts from the beginning
import { ChatArea, type ChatAreaRef } from '@/components/chat/chat-area';
import { agentsToParticipants, useAgentRegistry } from '@/lib/orchestration/registry/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { VisuallyHidden } from 'radix-ui';
import { InteractiveIframeHost } from '@/components/scene-renderers/InteractiveIframeHost';

/**
 * WeChat / X5 (TBS) WebView guard for the Fullscreen API.
 *
 * WeChat's built-in browser uses the X5 / TBS kernel on Android (and a
 * modified WebKit on iOS). Both of them have a long-standing bug where
 * calling `Element.requestFullscreen()` — even on a plain <div> — can
 * synchronously crash the entire WebView process, taking the user back
 * to the chat list. The browser's "back" navigation never fires, so
 * the only symptom is a flash-to-foreground of the chat.
 *
 * It only manifests in two specific conditions:
 *   1. Inside a WeChat WebView (UA contains "MicroMessenger"), OR
 *   2. On Android with the X5/TBS kernel (UA contains "TBS/" or "X5Core")
 *
 * The crash is synchronous — try/catch on the returned Promise won't
 * save us, because the WebView dies before the rejection is dispatched.
 * The only safe fix is to never call requestFullscreen() in the first
 * place. The "presentation-style" view (chrome hidden, canvas takes
 * the full content height) still works via isPresenting — the only
 * thing we lose is *real* OS-level fullscreen, which is acceptable on
 * mobile anyway.
 *
 * Also, calling `navigator.keyboard?.lock()` is similarly broken on
 * some WeChat builds, so we keep the existing `.catch(() => {})` there
 * — it's safe because it's a separate API.
 *
 * We intentionally do NOT match the `isMobile` regex used elsewhere
 * (which is just UA-based and matches iOS Safari + Android Chrome
 * equally). The X5 guard is a stricter condition that fires ONLY on
 * the WeChat / X5 paths where the crash is reproducible.
 */
function shouldSkipFullscreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS WeChat: UA contains "MicroMessenger" (the underlying WebKit
  // is AppleWebKit-based and shares the iOS fullscreen quirks, but
  // the WeChat JS bridge + its custom WebView shell can also trigger
  // crashes when requestFullscreen is called from a non-gesture event).
  const isWechat = /MicroMessenger/i.test(ua);
  // Android WeChat X5/TBS kernel: UA contains "TBS/" and/or "X5Core"
  const isX5 = /\bTBS\//.test(ua) || /X5Core/i.test(ua);
  const skip = isWechat || isX5;
  // DEBUG: surface this to vConsole so we can verify the guard
  // actually fires on the user's device. Remove after the WeChat
  // flash-to-chat crash is confirmed fixed.
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[Stage-X5-Guard]', {
      uaSnippet: ua.substring(0, 240),
      isWechat,
      isX5,
      willSkipFullscreen: skip,
    });
  }
  return skip;
}

// Module-level guard so the global error/unhandledrejection hooks
// are installed at most once (React StrictMode runs effects twice
// in dev, and we don't want duplicate listeners competing with
// each other or stomping over the user's own error handlers).
let __x5DebugHooksInstalled = false;
function installX5DebugHooks() {
  if (typeof window === 'undefined' || __x5DebugHooksInstalled) return;
  __x5DebugHooksInstalled = true;
  // WeChat's built-in X5 debug bridge — available on TBS / X5
  // builds. It exposes a global `WeixinJSBridge` and a console
  // that pipes to logcat. The `vConsole` import below only runs
  // if the user is actually on a WeChat / X5 device.
  window.addEventListener('error', (event) => {
    // eslint-disable-next-line no-console
    console.error('[X5-Debug-error]', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
      error: event.error?.stack ?? event.error,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    // eslint-disable-next-line no-console
    console.error('[X5-Debug-unhandledrejection]', {
      reason: event.reason,
      stack: (event.reason && (event.reason as Error).stack) ?? null,
    });
  });
  // Tap every pointerdown so we can see — in vConsole — exactly
  // what the device is receiving before the alleged crash. If
  // this never logs, the WebView is dying synchronously inside
  // the browser event loop and JS can't even run. If it logs a
  // few times and then stops, we know the crash happens after
  // some specific user interaction.
  document.addEventListener(
    'pointerdown',
    (e) => {
      // eslint-disable-next-line no-console
      console.log('[X5-Debug-pointerdown]', {
        target: (e.target as HTMLElement | null)?.tagName ?? 'unknown',
        className: (e.target as HTMLElement | null)?.className ?? null,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    { capture: true },
  );
}

/**
 * Stage Component
 *
 * The main container for the classroom/course.
 * Combines sidebar (scene navigation) and content area (scene viewer).
 * Supports two modes: autonomous and playback.
 */
export function Stage({
  onRetryOutline,
  onLectureComplete,
  defaultPresentation = false,
  autoPlay = false,
  autoFullscreen = false,
  // Optional overlays rendered INSIDE the stage's root element
  // (so they survive autoFullscreen — the browser's fullscreen
  // API renders only the fullscreened element and its
  // descendants, hiding every sibling). Each is `position:
  // absolute`-ed to its respective corner with `pointer-events:
  // auto` so it stays clickable. Pass `null` (the default) to
  // skip a corner.
  topLeftOverlay = null,
  topRightOverlay = null,
}: {
  onRetryOutline?: (outlineId: string) => Promise<void>;
  onLectureComplete?: () => void;
  defaultPresentation?: boolean;
  autoPlay?: boolean;
  /**
   * When true, the stage attempts to enter fullscreen + collapse the
   * sidebar/chat on mount. Most browsers will reject the auto-fullscreen
   * request without a user gesture — in that case the UI still collapses
   * (sidebar/chat hidden, header hidden via isPresenting) and the user
   * can press F11 to enter fullscreen manually. Has no effect on the
   * homework/homework-presentation flows (those keep their own
   * defaultPresentation path).
   */
  autoFullscreen?: boolean;
  /**
   * Optional ReactNode rendered at the top-left of the stage's
   * root, inside the fullscreen subtree. Use for back-to-library
   * / "我的学习" pills on /classroom/[id] — they MUST live here
   * (not as siblings of `<Stage />`) so they remain visible +
   * clickable when autoFullscreen fires `requestFullscreen()` on
   * the stage root.
   */
  topLeftOverlay?: ReactNode;
  /**
   * Same as topLeftOverlay but anchored to the top-right. Used
   * for the "加入错题本" button on /classroom/[id].
   */
  topRightOverlay?: ReactNode;
}) {
  const { t } = useI18n();
  const {
    mode,
    getCurrentScene,
    scenes,
    currentSceneId,
    setCurrentSceneId,
    generatingOutlines,
    outlines,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const failedOutlineReason = useStageStore.use.failedOutlineReason();

  const currentScene = getCurrentScene();

  // 真题卷一页模式 (FULL_PAPER): buildMergedQuiz in
  // SceneRenderer takes the first quiz scene in order and
  // stitches every following quiz scene's questions into
  // a single long page. The merged paper IS the
  // classroom — the user navigates within the page
  // (previous/next question), not between scene covers.
  // Hide the per-scene covers (e.g. the 随堂测验 card for
  // the read1 sub-quiz that the user complained about)
  // from the sidebar AND from the keyboard / button
  // next-scene traversal, so the user sees a single
  // "开始答题 → 答完 → 报告" flow instead of being
  // bounced into the read1 sub-quiz's cover after
  // submitting the merged paper.
  const stageId = useStageStore((s) => s.stage?.id ?? null);
  const displayScenes = useMemo(() => {
    if (!stageId) return scenes;
    if (!FULL_PAPER_CLASSROOM_IDS.has(stageId)) return scenes;
    const firstQuiz = scenes.find((s) => s.type === 'quiz');
    if (!firstQuiz) return scenes;
    return [firstQuiz];
  }, [scenes, stageId]);

  // Layout state from settings store (persisted via localStorage)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const setChatAreaWidth = useSettingsStore((s) => s.setChatAreaWidth);
  const chatAreaCollapsed = useSettingsStore((s) => s.chatAreaCollapsed);
  const setChatAreaCollapsed = useSettingsStore((s) => s.setChatAreaCollapsed);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);

  // PlaybackEngine state
  const [engineMode, setEngineMode] = useState<EngineMode>('idle');
  const [playbackCompleted, setPlaybackCompleted] = useState(false); // Distinguishes "never played" idle from "finished" idle
  const [lectureSpeech, setLectureSpeech] = useState<string | null>(null); // From PlaybackEngine (lecture)
  const [isAutoStartingPlayback, setIsAutoStartingPlayback] = useState(false);
  const [liveSpeech, setLiveSpeech] = useState<string | null>(null); // From buffer (discussion/QA)
  const [speechProgress, setSpeechProgress] = useState<number | null>(null); // StreamBuffer reveal progress (0–1)
  const [discussionTrigger, setDiscussionTrigger] = useState<TriggerEvent | null>(null);

  // Speaking agent tracking (Issue 2)
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);

  // Thinking state (Issue 5)
  const [thinkingState, setThinkingState] = useState<{
    stage: string;
    agentId?: string;
  } | null>(null);

  // Cue user state (Issue 7)
  const [isCueUser, setIsCueUser] = useState(false);

  // End flash state (Issue 3)
  const [showEndFlash, setShowEndFlash] = useState(false);
  const [endFlashSessionType, setEndFlashSessionType] = useState<'qa' | 'discussion'>('discussion');

  // Streaming state for stop button (Issue 1)
  const [chatIsStreaming, setChatIsStreaming] = useState(false);
  const [chatSessionType, setChatSessionType] = useState<string | null>(null);

  // Topic pending state: session is soft-paused, bubble stays visible, waiting for user input
  const [isTopicPending, setIsTopicPending] = useState(false);

  // Active bubble ID for playback highlight in chat area (Issue 8)
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // Scene switch confirmation dialog state
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(defaultPresentation);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPresentationInteractionActive, setIsPresentationInteractionActive] = useState(false);

  // Whiteboard state (from canvas store so AI tools can open it)
  const whiteboardOpen = useCanvasStore.use.whiteboardOpen();
  const setWhiteboardOpen = useCanvasStore.use.setWhiteboardOpen();
  const whiteboardEnabled = shouldEnableHomeworkWhiteboard({ defaultPresentation });

  // Selected agents from settings store (Zustand)
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  // Generate participants from selected agents
  const participants = useMemo(
    () => agentsToParticipants(selectedAgentIds, t),
    [selectedAgentIds, t],
  );

  // Resolved AgentConfig array for hooks that need full agent objects
  // Subscribe to the agents record so voiceConfig changes trigger re-resolution
  const agentsRecord = useAgentRegistry((s) => s.agents);
  const selectedAgents = useMemo(
    () => selectedAgentIds.map((id) => agentsRecord[id]).filter((a): a is AgentConfig => a != null),
    [agentsRecord, selectedAgentIds],
  );

  // Discussion TTS: audio indicator state
  const [audioIndicatorState, setAudioIndicatorState] = useState<AudioIndicatorState>('idle');
  const [audioAgentId, setAudioAgentId] = useState<string | null>(null);

  const discussionTTS = useDiscussionTTS({
    enabled: ttsEnabled && !ttsMuted,
    agents: selectedAgents,
    onAudioStateChange: (agentId, state) => {
      setAudioAgentId(agentId);
      setAudioIndicatorState(state);
    },
  });

  // Pick a student agent for discussion trigger (prioritize student > non-teacher > fallback)
  const pickStudentAgent = useCallback((): string => {
    const registry = useAgentRegistry.getState();
    const agents = selectedAgentIds
      .map((id) => registry.getAgent(id))
      .filter((a): a is AgentConfig => a != null);
    const students = agents.filter((a) => a.role === 'student');
    if (students.length > 0) {
      return students[Math.floor(Math.random() * students.length)].id;
    }
    const nonTeachers = agents.filter((a) => a.role !== 'teacher');
    if (nonTeachers.length > 0) {
      return nonTeachers[Math.floor(Math.random() * nonTeachers.length)].id;
    }
    return agents[0]?.id || 'default-1';
  }, [selectedAgentIds]);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const chatAreaRef = useRef<ChatAreaRef>(null);
  const lectureSessionIdRef = useRef<string | null>(null);
  const lectureCompleteNotifiedRef = useRef(false);
  const lectureActionCounterRef = useRef(0);
  const discussionAbortRef = useRef<AbortController | null>(null);
  const presentationIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Guard to prevent double flash when manual stop triggers onDiscussionEnd
  const manualStopRef = useRef(false);
  // Monotonic counter incremented on each scene switch — used to discard stale SSE callbacks
  const sceneEpochRef = useRef(0);
  // When true, the next engine init will auto-start playback (for auto-play scene advance)
  const autoStartRef = useRef(false);
  // CSP progress reporting (scene-complete / heartbeat / quiz-submit).
  // The hook sets up the 30s heartbeat and exposes the imperative
  // reporting methods. We call `reportSceneComplete` when the engine
  // transitions between scenes — the *previous* sceneId is the one
  // whose audio/TTS just finished naturally, and that's the moment
  // we credit the student for "viewing" it.
  const cspProgress = useCspProgress();
  // The sceneId the engine is currently processing. We track it
  // separately from `currentSceneId` (which moves on user click)
  // so we only credit scenes that the engine actually played
  // through to the end, not scenes the user just skipped past.
  const inFlightSceneIdRef = useRef<string | null>(null);
  // Discussion buffer-level pause state (distinct from soft-pause which aborts SSE)
  const [isDiscussionPaused, setIsDiscussionPaused] = useState(false);

  /**
   * Resume a soft-paused topic: re-call /chat with existing session messages.
   * The director picks the next agent to continue.
   */
  const doResumeTopic = useCallback(async () => {
    // Clear old bubble immediately — no lingering on interrupted text
    setIsTopicPending(false);
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setThinkingState({ stage: 'director' });
    setChatIsStreaming(true);
    // Transition engine back to live — onInputActivate paused it when soft-pausing,
    // so we must explicitly resume to keep engine mode in sync with the chat loop.
    engineRef.current?.resume();
    // Fire new chat round — SSE events will drive thinking → agent_start → speech
    await chatAreaRef.current?.resumeActiveSession();
  }, []);

  /** Reset all live/discussion state (shared by doSessionCleanup & onDiscussionEnd) */
  const resetLiveState = useCallback(() => {
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setSpeechProgress(null);
    setThinkingState(null);
    setIsCueUser(false);
    setIsTopicPending(false);
    setChatIsStreaming(false);
    setChatSessionType(null);
    setIsDiscussionPaused(false);
  }, []);

  /** Full scene reset (scene switch) — resetLiveState + lecture/visual state */
  const resetSceneState = useCallback(() => {
    resetLiveState();
    setPlaybackCompleted(false);
    setLectureSpeech(null);
    setSpeechProgress(null);
    setShowEndFlash(false);
    setActiveBubbleId(null);
    setDiscussionTrigger(null);
  }, [resetLiveState]);

  /** Request failure should exit live discussion UI without hard-closing the session. */
  const handleLiveSessionError = useCallback(() => {
    engineRef.current?.handleDiscussionError();
    resetLiveState();
    setActiveBubbleId(null);
  }, [resetLiveState]);

  /**
   * Unified session cleanup — called by both roundtable stop button and chat area end button.
   * Handles: engine transition, flash, roundtable state clearing.
   */
  const doSessionCleanup = useCallback(() => {
    const activeType = chatSessionType;

    // Engine cleanup — guard to avoid double flash from onDiscussionEnd
    manualStopRef.current = true;
    engineRef.current?.handleEndDiscussion();
    manualStopRef.current = false;

    // Show end flash with correct session type
    if (activeType === 'qa' || activeType === 'discussion') {
      setEndFlashSessionType(activeType);
      setShowEndFlash(true);
      setTimeout(() => setShowEndFlash(false), 1800);
    }

    // Stop any in-flight discussion TTS audio
    discussionTTS.cleanup();

    resetLiveState();
  }, [chatSessionType, resetLiveState, discussionTTS]);

  // Shared stop-discussion handler (used by both Roundtable and Canvas toolbar)
  const handleStopDiscussion = useCallback(async () => {
    await chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
  }, [doSessionCleanup]);

  const clearPresentationIdleTimer = useCallback(() => {
    if (presentationIdleTimerRef.current) {
      clearTimeout(presentationIdleTimerRef.current);
      presentationIdleTimerRef.current = null;
    }
  }, []);

  const resetPresentationIdleTimer = useCallback(() => {
    setControlsVisible(true);
    clearPresentationIdleTimer();
    if (isPresenting && !isPresentationInteractionActive) {
      presentationIdleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [clearPresentationIdleTimer, isPresenting, isPresentationInteractionActive]);

  const togglePresentation = useCallback(async () => {
    const stageElement = stageRef.current;
    if (!stageElement) return;

    // X5/WeChat WebView: see shouldSkipFullscreen() above. Even
    // when the user manually taps the fullscreen toggle, calling
    // requestFullscreen() crashes the WebView. Fall back to the
    // presentation-style view (chrome hidden, canvas full-height)
    // which is what we'd end up with anyway if the fullscreen
    // request rejected on any other mobile browser. The exit path
    // (toggling back to normal) is a no-op since we never entered
    // real fullscreen — the existing `isPresenting` branch at the
    // top of this function already handles that correctly.
    if (shouldSkipFullscreen()) {
      if (isPresenting) {
        setIsPresenting(false);
        setSidebarCollapsed(false);
        setChatAreaCollapsed(false);
      } else {
        setControlsVisible(true);
        setSidebarCollapsed(true);
        setChatAreaCollapsed(true);
        setIsPresenting(true);
      }
      return;
    }

    try {
      if (document.fullscreenElement === stageElement) {
        // Already in real fullscreen — exit.
        // Unlock Escape key before exiting fullscreen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        await document.exitFullscreen();
        return;
      }

      if (isPresenting) {
        // In presentation mode (chrome hidden) but not in real
        // fullscreen — this is the mobile path where
        // `requestFullscreen()` was rejected. The user is tapping the
        // exit button on the floating controls. Drop out of
        // presentation mode and re-show the chrome. The
        // `fullscreenchange` listener will not fire (we never
        // entered real fullscreen) so we have to clean up the
        // collapsed sidebar/chat ourselves.
        setIsPresenting(false);
        setSidebarCollapsed(false);
        setChatAreaCollapsed(false);
        return;
      }

      setControlsVisible(true);
      setSidebarCollapsed(true);
      setChatAreaCollapsed(true);
      // Enter presentation mode BEFORE the fullscreen request so that
      // even if `requestFullscreen()` rejects (mobile Safari, Android
      // Chrome without a user gesture) the chrome is already hidden
      // and the canvas takes the full height. The user is in a
      // "presentation-style" view; they can tap the floating exit
      // button to leave it.
      setIsPresenting(true);
      await stageElement.requestFullscreen();
      // Lock Escape key so it doesn't auto-exit fullscreen (#255)
      // Escape is handled manually in our keydown handler instead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {});
    } catch {
      // Firefox may deny fullscreen from certain keyboard events (e.g. F11)
      console.warn('[Presentation] Fullscreen request denied — browser policy');
    }
  }, [isPresenting, setChatAreaCollapsed, setSidebarCollapsed]);

  // Auto-enter presentation on mount. Unlike `togglePresentation`, this
  // applies the UI changes (collapsed sidebar/chat, visible controls)
  // BEFORE the fullscreen request, so a browser rejection still leaves
  // the user in a presentation-style layout instead of dropping them
  // back to the normal chrome-heavy view.
  const enterPresentation = useCallback(async () => {
    const stageElement = stageRef.current;
    if (!stageElement) return;

    setControlsVisible(true);
    setSidebarCollapsed(true);
    setChatAreaCollapsed(true);
    // Enter presentation mode even if the fullscreen request rejects.
    // On mobile (iOS Safari especially) `requestFullscreen()` on a
    // non-<video> element is a no-op or rejected outright, so the
    // "real" fullscreen is unreachable. The presentation-style view
    // (header hidden, sidebar/chat collapsed, canvas taking the full
    // main-content height) is the best we can do, and that requires
    // `isPresenting` to be true.
    setIsPresenting(true);

    // X5/WeChat WebView: requestFullscreen() crashes the WebView
    // process synchronously, so try/catch is useless. Skip the call
    // entirely — the presentation-style view above is all the user
    // gets on WeChat anyway, and it's the only safe behaviour.
    if (shouldSkipFullscreen()) return;

    try {
      await stageElement.requestFullscreen();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {});
    } catch {
      // Most browsers reject auto-fullscreen without a user gesture;
      // the UI is already in presentation mode so the user just needs
      // to press F11 (or click) to upgrade to real fullscreen.
      console.warn('[Presentation] Auto-fullscreen denied — browser policy');
    }
  }, [setChatAreaCollapsed, setSidebarCollapsed]);

  // Fire enterPresentation on mount when autoFullscreen is enabled.
  // We defer with a short timeout so the first paint lands before the
  // browser popup, and so the stageRef is guaranteed to be attached.
  useEffect(() => {
    // Install global error / unhandledrejection / pointerdown
    // listeners exactly once, the first time the Stage component
    // mounts. These run on every browser, not just WeChat — the
    // log volume is negligible and the diagnostic value during the
    // current WeChat crash hunt is high. See installX5DebugHooks.
    installX5DebugHooks();
    if (!autoFullscreen) return;
    // X5/WeChat WebView: do NOTHING. Calling requestFullscreen()
    // synchronously crashes the WebView, and even setting
    // `isPresenting=true` (which collapses the chrome and enlarges
    // the canvas to fill the viewport) can trigger the same crash
    // path because the resulting layout change includes CSS
    // transforms that the X5 kernel handles badly. The trade-off
    // is the student sees the normal non-presenting chrome
    // (header + sidebar + chat) on WeChat, but at least the page
    // doesn't flash back to the chat list on the first tap.
    if (shouldSkipFullscreen()) return;
    const t = window.setTimeout(() => {
      void enterPresentation();
    }, 250);
    return () => window.clearTimeout(t);
  }, [autoFullscreen, enterPresentation]);

  // Most browsers reject requestFullscreen() without a user gesture,
  // so the mount-time attempt above usually fails. Retry on the
  // first pointerdown / keydown so fullscreen kicks in as soon as
  // the student interacts with the page (which they always do to
  // start the slideshow anyway). Uses capture phase + { once: true }
  // so the listener fires exactly once and is then cleaned up.
  useEffect(() => {
    if (!autoFullscreen) return;
    // X5/WeChat WebView: see shouldSkipFullscreen() above. Installing
    // a click listener that calls requestFullscreen() on every tap is
    // the most reliable way to crash a WeChat WebView on Android —
    // the user just clicks once (e.g. on the "Next" button) and the
    // whole view flashes back to the chat list. We skip the entire
    // listener install so no path leads to the API call.
    if (shouldSkipFullscreen()) return;
    if (typeof document === 'undefined') return;

    const tryFullscreen = () => {
      const stageElement = stageRef.current;
      if (!stageElement) return;
      if (document.fullscreenElement === stageElement) return;
      stageElement
        .requestFullscreen()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(() => (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {}))
        .catch(() => {
          /* still no user gesture — will retry on next interaction */
        });
    };

    const opts: AddEventListenerOptions = { capture: true, once: false };
    document.addEventListener('pointerdown', tryFullscreen, opts);
    document.addEventListener('keydown', tryFullscreen, opts);
    document.addEventListener('touchstart', tryFullscreen, opts);

    return () => {
      document.removeEventListener('pointerdown', tryFullscreen, opts);
      document.removeEventListener('keydown', tryFullscreen, opts);
      document.removeEventListener('touchstart', tryFullscreen, opts);
    };
  }, [autoFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsPresenting((current) => {
        // Once we are in presentation mode we stay in it. The
        // fullscreenchange event fires for both enter and exit, but
        // on mobile `requestFullscreen()` rejects, so the user is in
        // presentation mode (chrome hidden, canvas takes the full
        // height) without ever being in real fullscreen. Clobbering
        // `isPresenting` back to false on a fullscreen exit would
        // un-hide the header and shrink the canvas — the exact thing
        // the mobile path is trying to avoid. The explicit exit path
        // is the togglePresentation() branch, not this listener.
        if (current) return true;
        return getNextHomeworkPresentationState({
          defaultPresentation,
          isFullscreenActive: active,
        });
      });

      if (!active) {
        // Ensure keyboard unlock on any fullscreen exit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        setControlsVisible(true);
        clearPresentationIdleTimer();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [clearPresentationIdleTimer, defaultPresentation]);

  // Auto fullscreen on mobile landscape orientation
  useEffect(() => {
    // Only enable on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    // X5/WeChat WebView: see shouldSkipFullscreen() above. Calling
    // requestFullscreen() from the orientationchange handler is just
    // as crash-prone as calling it from a click — the X5 kernel
    // doesn't distinguish, and any attempt to enter real fullscreen
    // on a phone-sized landscape display flashes the user back to
    // the chat list. Skip the handler entirely.
    if (shouldSkipFullscreen()) return;

    const handleOrientationChange = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const stageElement = stageRef.current;
      if (!stageElement) return;

      if (isLandscape && document.fullscreenElement !== stageElement) {
        // Enter fullscreen when rotating to landscape
        const requestFS = stageElement.requestFullscreen || (stageElement as any).webkitRequestFullscreen;
        if (typeof requestFS === 'function') {
          requestFS.call(stageElement).catch(() => {
            // Silently fail if fullscreen is not allowed
          });
        }
      } else if (!isLandscape && document.fullscreenElement === stageElement) {
        // Exit fullscreen when rotating back to portrait
        const exitFS = document.exitFullscreen || (document as any).webkitExitFullscreen;
        if (typeof exitFS === 'function') {
          exitFS.call(document).catch(() => {
            // Silently fail
          });
        }
      }
    };

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    // Also check on resize (some devices don't fire orientationchange reliably)
    window.addEventListener('resize', handleOrientationChange);

    // Initial check
    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    if (!isPresenting) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
      return;
    }

    const handleActivity = () => {
      resetPresentationIdleTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    if (isPresentationInteractionActive) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
    } else {
      resetPresentationIdleTimer();
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearPresentationIdleTimer();
    };
  }, [
    clearPresentationIdleTimer,
    isPresenting,
    isPresentationInteractionActive,
    resetPresentationIdleTimer,
  ]);

  // Initialize playback engine when scene changes
  useEffect(() => {
    // Bump epoch so any stale SSE callbacks from the previous scene are discarded
    sceneEpochRef.current++;

    // End any active QA/discussion session — this synchronously aborts the SSE
    // stream inside use-chat-sessions (abortControllerRef.abort()), preventing
    // stale onLiveSpeech callbacks from leaking into the new scene.
    chatAreaRef.current?.endActiveSession();

    // Also abort the engine-level discussion controller
    if (discussionAbortRef.current) {
      discussionAbortRef.current.abort();
      discussionAbortRef.current = null;
    }

    // Stop any in-flight discussion TTS audio on scene switch
    discussionTTS.cleanup();

    // Reset all roundtable/live state so scenes are fully isolated
    resetSceneState();

    if (!currentScene || !currentScene.actions || currentScene.actions.length === 0) {
      engineRef.current = null;
      setEngineMode('idle');
      setIsAutoStartingPlayback(false);

      return;
    }

    // Stop previous engine
    if (engineRef.current) {
      engineRef.current.stop();
    }

    // Get widget iframe messaging callback for interactive scenes (keyed by sceneId)
    const widgetSendMessage = useWidgetIframeStore.getState().getSendMessage(currentScene.id);

    // Create ActionEngine for playback (with audioPlayer for TTS and widget messaging)
    const actionEngine = new ActionEngine(useStageStore, audioPlayerRef.current, widgetSendMessage);

    // Create new PlaybackEngine
    const engine = new PlaybackEngine([currentScene], actionEngine, audioPlayerRef.current, {
      onModeChange: (mode) => {
        setEngineMode(mode);
      },
      onSceneChange: (sceneId) => {
        // CSP progress: the previous scene just finished its natural
        // playback (TTS reached the end of the last action). Credit
        // it now. We don't fire on the very first onSceneChange of
        // a freshly-mounted engine (inFlightSceneIdRef is null),
        // because no scene has actually completed yet — the engine
        // is just starting. For multi-scene classrooms this fires
        // N-1 times; the Nth scene is credited in onComplete below.
        const previous = inFlightSceneIdRef.current;
        if (previous && previous !== sceneId) {
          void cspProgress.reportSceneComplete(previous);
        }
        inFlightSceneIdRef.current = sceneId;
      },
      onSpeechStart: (text) => {
        setLectureSpeech(text);
        // Add to lecture session with incrementing index for dedup
        // Chat area pacing is handled by the StreamBuffer (onTextReveal)
        if (lectureSessionIdRef.current) {
          const idx = lectureActionCounterRef.current++;
          const speechId = `speech-${Date.now()}`;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            { id: speechId, type: 'speech', text } as Action,
            idx,
          );
          // Track active bubble for highlight (Issue 8)
          const msgId = chatAreaRef.current?.getLectureMessageId(lectureSessionIdRef.current!);
          if (msgId) setActiveBubbleId(msgId);
        }
      },
      onSpeechEnd: () => {
        // Don't clear lectureSpeech — let it persist until the next
        // onSpeechStart replaces it or the scene transitions.
        // Clearing here causes fallback to idleText (first sentence).
        setActiveBubbleId(null);
      },
      onEffectFire: (effect: Effect) => {
        // Add to lecture session with incrementing index
        if (
          lectureSessionIdRef.current &&
          (effect.kind === 'spotlight' || effect.kind === 'laser')
        ) {
          const idx = lectureActionCounterRef.current++;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            {
              id: `${effect.kind}-${Date.now()}`,
              type: effect.kind,
              elementId: effect.targetId,
            } as Action,
            idx,
          );
        }
      },
      onProactiveShow: (trigger) => {
        if (!trigger.agentId) {
          // Mutate in-place so engine.currentTrigger also gets the agentId
          // (confirmDiscussion reads agentId from the same object reference)
          trigger.agentId = pickStudentAgent();
        }
        setDiscussionTrigger(trigger);
      },
      onProactiveHide: () => {
        setDiscussionTrigger(null);
      },
      onDiscussionConfirmed: (topic, prompt, agentId) => {
        // Start SSE discussion via ChatArea
        handleDiscussionSSE(topic, prompt, agentId);
      },
      onDiscussionEnd: () => {
        // Abort any active SSE
        if (discussionAbortRef.current) {
          discussionAbortRef.current.abort();
          discussionAbortRef.current = null;
        }
        setDiscussionTrigger(null);
        // Stop any in-flight discussion TTS audio
        discussionTTS.cleanup();
        // Clear roundtable state (idempotent — may already be cleared by doSessionCleanup)
        resetLiveState();
        // Only show flash for engine-initiated ends (not manual stop — that's handled by doSessionCleanup)
        if (!manualStopRef.current) {
          setEndFlashSessionType('discussion');
          setShowEndFlash(true);
          setTimeout(() => setShowEndFlash(false), 1800);
        }
        // If all actions are exhausted (discussion was the last action), mark
        // playback as completed so the bubble shows reset instead of play.
        if (engineRef.current?.isExhausted()) {
          setPlaybackCompleted(true);
        }
      },
      onUserInterrupt: (text) => {
        // User interrupted → start a discussion via chat
        chatAreaRef.current?.sendMessage(text);
      },
      isAgentSelected: (agentId) => {
        const ids = useSettingsStore.getState().selectedAgentIds;
        return ids.includes(agentId);
      },
      getPlaybackSpeed: () => useSettingsStore.getState().playbackSpeed || 1,
      onComplete: () => {
        // lectureSpeech intentionally NOT cleared — last sentence stays visible
        // until scene transition (auto-play) or user restarts. Scene change
        // effect handles the reset.
        setPlaybackCompleted(true);

        // CSP progress: the last scene's playback has finished.
        // onSceneChange credited every other scene; this one only
        // reaches us via onComplete. Clear the ref afterwards so
        // a subsequent re-play (e.g. user clicks restart) starts
        // from a clean slate.
        const lastSceneId = inFlightSceneIdRef.current;
        if (lastSceneId) {
          void cspProgress.reportSceneComplete(lastSceneId);
          inFlightSceneIdRef.current = null;
        }

        // End lecture session on playback complete
        if (lectureSessionIdRef.current) {
          chatAreaRef.current?.endSession(lectureSessionIdRef.current);
          lectureSessionIdRef.current = null;
        }
        // Auto-play: advance to next scene after a short pause
        const { autoPlayLecture } = useSettingsStore.getState();
        if (autoPlayLecture) {
          setTimeout(() => {
            const stageState = useStageStore.getState();
            if (!useSettingsStore.getState().autoPlayLecture) return;
            const allScenes = stageState.scenes;
            const curId = stageState.currentSceneId;
            const idx = allScenes.findIndex((s) => s.id === curId);
            if (idx >= 0 && idx < allScenes.length - 1) {
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(allScenes[idx + 1].id);
            } else if (idx === allScenes.length - 1 && stageState.generatingOutlines.length > 0) {
              // Last scene exhausted but next is still generating — go to pending page
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(PENDING_SCENE_ID);
            }
          }, 1500);
        }
      },
    });

    engineRef.current = engine;

    // Auto-start if triggered by auto-play scene advance or user preference
    const shouldAutoStart =
      autoPlay || autoStartRef.current || useSettingsStore.getState().autoPlayLecture;
    let isActive = true;

    if (shouldAutoStart) {
      autoStartRef.current = false;
      setIsAutoStartingPlayback(true);
      void (async () => {
        if (currentScene && chatAreaRef.current) {
          const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
          if (!isActive) return;
          lectureSessionIdRef.current = sessionId;
          lectureActionCounterRef.current = 0;
        }
        if (isActive) {
          engine.start();
          setIsAutoStartingPlayback(false);
        }
      })();
    } else {
      setIsAutoStartingPlayback(false);
      // Load saved playback state and restore position (but never auto-play).
    }

    return () => {
      isActive = false;
      setIsAutoStartingPlayback(false);
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when scene changes, functions are stable refs
  }, [currentScene?.id, currentScene?.actions?.length, autoPlay]);

  useEffect(() => {
    if (!playbackCompleted || lectureCompleteNotifiedRef.current) {
      return;
    }

    lectureCompleteNotifiedRef.current = true;
    onLectureComplete?.();
  }, [onLectureComplete, playbackCompleted]);

  useEffect(() => {
    lectureCompleteNotifiedRef.current = false;
  }, [currentSceneId]);

  useEffect(() => {
    setIsPresenting(defaultPresentation);
  }, [defaultPresentation]);

  useEffect(() => {
    if (whiteboardEnabled || !whiteboardOpen) {
      return;
    }

    setWhiteboardOpen(false);
  }, [setWhiteboardOpen, whiteboardEnabled, whiteboardOpen]);

  // Cleanup on unmount
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;
    const chatArea = chatAreaRef.current;
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      audioPlayer.destroy();
      if (discussionAbortRef.current) {
        discussionAbortRef.current.abort();
      }
      discussionTTS.cleanup();
      chatArea?.endActiveSession();
      clearPresentationIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup, clearPresentationIdleTimer is stable
  }, []);

  // Sync mute state from settings store to audioPlayer
  useEffect(() => {
    audioPlayerRef.current.setMuted(ttsMuted);
  }, [ttsMuted]);

  // Sync volume from settings store to audioPlayer
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  useEffect(() => {
    if (!ttsMuted) {
      audioPlayerRef.current.setVolume(ttsVolume);
    }
  }, [ttsVolume, ttsMuted]);

  // Sync playback speed to audio player (for live-updating current audio)
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  useEffect(() => {
    audioPlayerRef.current.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  /**
   * Handle discussion SSE — POST /api/chat and push events to engine
   */
  const handleDiscussionSSE = useCallback(
    async (topic: string, prompt?: string, agentId?: string) => {
      // Start discussion display in ChatArea (lecture speech is preserved independently)
      chatAreaRef.current?.startDiscussion({
        topic,
        prompt,
        agentId: agentId || 'default-1',
      });
      // Auto-switch to chat tab when discussion starts
      chatAreaRef.current?.switchToTab('chat');
      // Immediately mark streaming for synchronized stop button
      setChatIsStreaming(true);
      setChatSessionType('discussion');
      // Optimistic thinking: show thinking dots immediately (same as onMessageSend)
      setThinkingState({ stage: 'director' });
    },
    [],
  );

  // First speech text for idle display (extracted here for playbackView)
  const firstSpeechText = useMemo(
    () => currentScene?.actions?.find((a): a is SpeechAction => a.type === 'speech')?.text ?? null,
    [currentScene],
  );

  // Whether the speaking agent is a student (for bubble role derivation)
  const speakingStudentFlag = useMemo(() => {
    if (!speakingAgentId) return false;
    const agent = useAgentRegistry.getState().getAgent(speakingAgentId);
    return agent?.role !== 'teacher';
  }, [speakingAgentId]);

  // Centralised derived playback view
  const playbackView = useMemo(
    () =>
      computePlaybackView({
        engineMode,
        lectureSpeech,
        liveSpeech,
        speakingAgentId,
        thinkingState,
        isCueUser,
        isTopicPending,
        chatIsStreaming,
        discussionTrigger,
        playbackCompleted,
        idleText: firstSpeechText,
        speakingStudent: speakingStudentFlag,
        sessionType: chatSessionType,
      }),
    [
      engineMode,
      lectureSpeech,
      liveSpeech,
      speakingAgentId,
      thinkingState,
      isCueUser,
      isTopicPending,
      chatIsStreaming,
      discussionTrigger,
      playbackCompleted,
      firstSpeechText,
      speakingStudentFlag,
      chatSessionType,
    ],
  );

  const isTopicActive = playbackView.isTopicActive;

  /**
   * Gated scene switch — if a topic is active, show AlertDialog before switching.
   * Returns true if the switch was immediate, false if gated (dialog shown).
   */
  const gatedSceneSwitch = useCallback(
    (targetSceneId: string): boolean => {
      if (targetSceneId === currentSceneId) return false;
      if (isTopicActive) {
        setPendingSceneId(targetSceneId);
        return false;
      }
      setCurrentSceneId(targetSceneId);
      return true;
    },
    [currentSceneId, isTopicActive, setCurrentSceneId],
  );

  /** User confirmed scene switch via AlertDialog */
  const confirmSceneSwitch = useCallback(() => {
    if (!pendingSceneId) return;
    chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
    setCurrentSceneId(pendingSceneId);
    setPendingSceneId(null);
  }, [pendingSceneId, setCurrentSceneId, doSessionCleanup]);

  /** User cancelled scene switch via AlertDialog */
  const cancelSceneSwitch = useCallback(() => {
    setPendingSceneId(null);
  }, []);

  // play/pause toggle
  const handlePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const mode = engine.getMode();
    if (mode === 'playing' || mode === 'live') {
      engine.pause();
      // Pause lecture buffer so text stops immediately
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.pauseBuffer(lectureSessionIdRef.current);
      }
    } else if (mode === 'paused') {
      engine.resume();
      // Resume lecture buffer
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.resumeBuffer(lectureSessionIdRef.current);
      }
    } else {
      const wasCompleted = playbackCompleted;
      setPlaybackCompleted(false);
      // Starting playback - create/reuse lecture session
      if (currentScene && chatAreaRef.current) {
        const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
        lectureSessionIdRef.current = sessionId;
      }
      if (wasCompleted) {
        // Restart from beginning (user clicked restart after completion)
        lectureActionCounterRef.current = 0;
        engine.start();
      } else {
        // Continue from current position (e.g. after discussion end)
        engine.continuePlayback();
      }
    }
  }, [playbackCompleted, currentScene]);

  // get scene information
  const isPendingScene = currentSceneId === PENDING_SCENE_ID;
  const hasNextPending = generatingOutlines.length > 0;
  // True when every outline has materialized into a scene and nothing is
  // currently generating — signals the classroom has finished and the user
  // can see a completion page. Comparing scenes.length === outlines.length
  // (rather than just `scenes.length > 0`) means a partial generation with
  // some failed outlines does not falsely trigger completion.
  const isCourseComplete =
    outlines.length > 0 && scenes.length === outlines.length && generatingOutlines.length === 0;
  const canAdvanceToPendingSlot = hasNextPending || isCourseComplete;

  // previous scene (gated)
  const handlePreviousScene = useCallback(() => {
    if (isPendingScene) {
      // From pending page → go to last real scene
      if (displayScenes.length > 0) {
        gatedSceneSwitch(displayScenes[displayScenes.length - 1].id);
      }
      return;
    }
    const currentIndex = displayScenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex > 0) {
      gatedSceneSwitch(displayScenes[currentIndex - 1].id);
    }
  }, [currentSceneId, gatedSceneSwitch, isPendingScene, displayScenes]);

  // next scene (gated)
  const handleNextScene = useCallback(() => {
    if (isPendingScene) return; // Already on pending, nowhere to go
    const currentIndex = displayScenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex < displayScenes.length - 1) {
      gatedSceneSwitch(displayScenes[currentIndex + 1].id);
    } else if (canAdvanceToPendingSlot) {
      // On last real scene → advance to pending slot (generating or completion page)
      setCurrentSceneId(PENDING_SCENE_ID);
    }
  }, [
    currentSceneId,
    gatedSceneSwitch,
    canAdvanceToPendingSlot,
    isPendingScene,
    displayScenes,
    setCurrentSceneId,
  ]);

  const currentSceneIndex = isPendingScene
    ? displayScenes.length
    : displayScenes.findIndex((s) => s.id === currentSceneId);
  const totalScenesCount = displayScenes.length + (canAdvanceToPendingSlot ? 1 : 0);

  // get action information
  const totalActions = currentScene?.actions?.length || 0;

  // whiteboard toggle
  const handleWhiteboardToggle = () => {
    setWhiteboardOpen(
      getNextHomeworkWhiteboardOpenState({
        defaultPresentation,
        whiteboardOpen,
      }),
    );
  };

  const isPresentationShortcutTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return true;
    }

    return (
      target.closest(
        ['input', 'textarea', 'select', '[role="slider"]', 'input[type="range"]'].join(', '),
      ) !== null
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Let modifier-key combos (Ctrl+C, Ctrl+S, etc.) pass through to the browser
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        isPresentationShortcutTarget(event.target) ||
        isPresentationShortcutTarget(document.activeElement)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          if (!isPresenting) return;
          event.preventDefault();
          handlePreviousScene();
          resetPresentationIdleTimer();
          break;
        case 'ArrowRight':
          if (!isPresenting) return;
          event.preventDefault();
          handleNextScene();
          resetPresentationIdleTimer();
          break;
        case ' ':
        case 'Spacebar':
          // During active QA/discussion, Roundtable owns Space for
          // buffer-level pause/resume — don't also fire engine play/pause.
          if (chatSessionType === 'qa' || chatSessionType === 'discussion') break;
          event.preventDefault();
          handlePlayPause();
          break;
        case 'Escape':
          // With keyboard.lock(), Escape no longer auto-exits fullscreen.
          // If panels are open, roundtable handles Escape (close panels).
          // If no panels are open, manually exit fullscreen.
          if (isPresenting && !isPresentationInteractionActive) {
            event.preventDefault();
            togglePresentation();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          setTTSVolume(ttsVolume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setTTSVolume(ttsVolume - 0.1);
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          setTTSMuted(!ttsMuted);
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setSidebarCollapsed(!sidebarCollapsed);
          break;
        case 'c':
        case 'C':
          event.preventDefault();
          setChatAreaCollapsed(!chatAreaCollapsed);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    chatSessionType,
    chatAreaCollapsed,
    handleNextScene,
    handlePlayPause,
    handlePreviousScene,
    isPresenting,
    isPresentationInteractionActive,
    isPresentationShortcutTarget,
    resetPresentationIdleTimer,
    setChatAreaCollapsed,
    setSidebarCollapsed,
    setTTSMuted,
    setTTSVolume,
    sidebarCollapsed,
    togglePresentation,
    ttsMuted,
    ttsVolume,
  ]);

  // Intercept F11 to use our presentation fullscreen instead of browser fullscreen
  // This way ESC can exit fullscreen (browser F11 fullscreen requires F11 to exit)
  useEffect(() => {
    const onF11 = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        togglePresentation();
      }
    };

    window.addEventListener('keydown', onF11);
    return () => window.removeEventListener('keydown', onF11);
  }, [togglePresentation]);

  // Map engine mode to the CanvasArea's expected engine state
  const canvasEngineState = (() => {
    switch (engineMode) {
      case 'playing':
      case 'live':
        return 'playing';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  })();

  // Build discussion request for Roundtable ProactiveCard from trigger
  const discussionRequest: DiscussionAction | null = discussionTrigger
    ? {
        type: 'discussion',
        id: discussionTrigger.id,
        topic: discussionTrigger.question,
        prompt: discussionTrigger.prompt,
        agentId: discussionTrigger.agentId || 'default-1',
      }
    : null;

  // Computed pixel height for the canvas wrapper, mirroring the
  // OpenMAIC PlaybackChromeRoot pattern verbatim. The 80px
  // reservation accounts for the non-presenting header; the 192px
  // reservation accounts for the roundtable in playback mode
  // (also only when not presenting). In presenting mode both are
  // zeroed so the canvas fills the full Main Content height.
  //
  // The Roundtable is INSIDE Main Content Area in this project
  // (same as OpenMAIC — see line 1229), so the 80+192 subtraction
  // correctly accounts for the total non-canvas vertical space
  // inside Main Content.
  const sceneViewerHeight = (() => {
    const headerHeight = isPresenting ? 0 : 80;
    const roundtableHeight = mode === 'playback' && !isPresenting ? 192 : 0;
    return `calc(100% - ${headerHeight + roundtableHeight}px)`;
  })();

  return (
    <>
      <div
        ref={stageRef}
        className={cn(
          // `relative` here gives the absolute-positioned
          // `topLeftOverlay` / `topRightOverlay` below a
          // containing block. They MUST sit inside this root
          // (not as siblings of `<Stage />`) so they survive
          // autoFullscreen — the fullscreen API only renders
          // the fullscreened element + its descendants.
          'flex-1 flex overflow-hidden relative bg-gray-50 dark:bg-gray-900',
          isPresenting && !controlsVisible && 'cursor-none',
        )}
      >
      {/* Scene Sidebar */}
      <SceneSidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
        onSceneSelect={gatedSceneSwitch}
        onRetryOutline={onRetryOutline}
        isCourseComplete={isCourseComplete}
        scenes={displayScenes}
      />

      {/* Main Content Area */}
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden min-w-0 relative',
        currentScene?.type === 'interactive' && 'h-auto',
      )}>
        {/* Header */}
        {!isPresenting && (
          <Header
            currentSceneTitle={
              currentScene?.title ||
              (isCourseComplete && isPendingScene ? t('stage.courseComplete') : '')
            }
          />
        )}

        {/* Canvas Area */}
        <div
          className={cn(
            'overflow-hidden relative flex-1 min-h-0 isolate',
            currentScene?.type === 'interactive' && 'min-h-0',
          )}
          // OpenMAIC pattern: explicit pixel height so the inner
          // CanvasArea's `h-full` resolves to a real value (a bare
          // `flex-1` parent gives Chrome a "flex-allocated" height
          // which `height: 100%` cannot resolve against). The calc
          // subtracts 80 (header) + 192 (roundtable) from Main
          // Content's height in non-presenting playback mode. The
          // 100% here resolves to Main Content Area's height, which
          // IS a real value because motion.div is absolute inset-0
          // (definite) and the flex-1 chain from there down gives
          // each level a definite height.
          style={{ height: sceneViewerHeight }}
          suppressHydrationWarning
        >
          <CanvasArea
            currentScene={currentScene}
            currentSceneIndex={currentSceneIndex}
            scenesCount={totalScenesCount}
            mode={mode}
            engineState={canvasEngineState}
            isLiveSession={
              chatIsStreaming || isTopicPending || engineMode === 'live' || !!chatSessionType
            }
            whiteboardOpen={whiteboardOpen}
            sidebarCollapsed={sidebarCollapsed}
            chatCollapsed={chatAreaCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
            onPrevSlide={handlePreviousScene}
            onNextSlide={handleNextScene}
            onPlayPause={handlePlayPause}
            onWhiteboardClose={handleWhiteboardToggle}
            whiteboardEnabled={whiteboardEnabled}
            isPresenting={isPresenting}
            onTogglePresentation={togglePresentation}
            showStopDiscussion={
              engineMode === 'live' ||
              (chatIsStreaming && (chatSessionType === 'qa' || chatSessionType === 'discussion'))
            }
            onStopDiscussion={handleStopDiscussion}
            hideToolbar={(!isPresenting && mode === 'playback') || (isPresenting && !controlsVisible)}
            isPendingScene={isPendingScene}
            isAutoStarting={isAutoStartingPlayback}
            isCourseComplete={isCourseComplete}
            isGenerationFailed={
              isPendingScene && failedOutlines.some((f) => f.id === generatingOutlines[0]?.id)
            }
            generationFailureReason={failedOutlineReason}
            hasVisibleLectureContent={Boolean(lectureSpeech || liveSpeech || firstSpeechText)}
            onRetryGeneration={
              onRetryOutline && generatingOutlines[0]
                ? () => onRetryOutline(generatingOutlines[0].id)
                : undefined
            }
          />
        </div>

        {/* Roundtable Area */}
        {mode === 'playback' && (
          <div
            className={cn(
              'transition-opacity duration-300',
              !isPresenting && 'shrink-0',
              isPresenting && 'absolute inset-x-0 bottom-0 z-20',
            )}
          >
            <Roundtable
              mode={mode}
              initialParticipants={participants}
              playbackView={playbackView}
              currentSpeech={liveSpeech}
              lectureSpeech={lectureSpeech}
              idleText={firstSpeechText}
              playbackCompleted={playbackCompleted}
              discussionRequest={discussionRequest}
              engineMode={engineMode}
              isStreaming={chatIsStreaming}
              audioIndicatorState={audioIndicatorState}
              audioAgentId={audioAgentId}
              sessionType={
                chatSessionType === 'qa'
                  ? 'qa'
                  : chatSessionType === 'discussion'
                    ? 'discussion'
                    : undefined
              }
              speakingAgentId={speakingAgentId}
              speechProgress={speechProgress}
              showEndFlash={showEndFlash}
              endFlashSessionType={endFlashSessionType}
              thinkingState={thinkingState}
              isCueUser={isCueUser}
              isTopicPending={isTopicPending}
              onMessageSend={async (msg) => {
                // Always clear Level-1 pause state — the closure may hold a stale
                // isDiscussionPaused value (e.g. voice input's onTranscription callback
                // captures onMessageSend before React re-renders with the updated state).
                setIsDiscussionPaused(false);
                // Clear the sticky livePausedRef so the next agent-loop buffer
                // starts unpaused. (pauseActiveLiveBuffer sets a ref that new
                // buffers inherit — must be cleared before sendMessage creates one.)
                chatAreaRef.current?.resumeActiveLiveBuffer();
                // Flush any buffered / in-flight TTS audio from the previous
                // agent turn so it doesn't leak into the next round.
                discussionTTS.cleanup();
                // Clear soft-paused state — user is continuing the topic
                if (isTopicPending) {
                  setIsTopicPending(false);
                  setLiveSpeech(null);
                  setSpeakingAgentId(null);
                }
                // User interrupts during playback — handleUserInterrupt triggers
                // onUserInterrupt callback which already calls sendMessage, so skip
                // the direct sendMessage below to avoid sending twice.
                // Include 'paused' because onInputActivate pauses the engine before
                // the user finishes typing — without this the interrupt position
                // would never be saved and resuming after QA skips to the next sentence.
                if (
                  engineRef.current &&
                  (engineMode === 'playing' || engineMode === 'live' || engineMode === 'paused')
                ) {
                  engineRef.current.handleUserInterrupt(msg);
                } else {
                  chatAreaRef.current?.sendMessage(msg);
                }
                // Auto-switch to chat tab when user sends a message
                chatAreaRef.current?.switchToTab('chat');
                setIsCueUser(false);
                // Immediately mark streaming for synchronized stop button
                setChatIsStreaming(true);
                setChatSessionType(chatSessionType || 'qa');
                // Optimistic thinking: show thinking dots immediately so there's
                // no blank gap between userMessage expiry and the SSE thinking event.
                // The real SSE event will overwrite this with the same or updated value.
                setThinkingState({ stage: 'director' });
              }}
              onDiscussionStart={() => {
                // User clicks "Join" on ProactiveCard
                engineRef.current?.confirmDiscussion();
              }}
              onDiscussionSkip={() => {
                // User clicks "Skip" on ProactiveCard
                engineRef.current?.skipDiscussion();
              }}
              onStopDiscussion={handleStopDiscussion}
              onInputActivate={() => {
                // Level-1 pause: freeze buffer tick + TTS audio while SSE keeps buffering.
                // User resumes manually via Space / pause button after closing the input.
                // No isDiscussionPaused guard — always attempt to pause the buffer.
                // The return value ensures UI state stays in sync with buffer state.
                if (chatSessionType === 'qa' || chatSessionType === 'discussion') {
                  const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                  if (paused) {
                    discussionTTS.pause();
                    setIsDiscussionPaused(true);
                  }
                }
                // Also pause playback engine
                if (engineRef.current && (engineMode === 'playing' || engineMode === 'live')) {
                  engineRef.current.pause();
                }
              }}
              onResumeTopic={doResumeTopic}
              onPlayPause={handlePlayPause}
              isDiscussionPaused={isDiscussionPaused}
              onDiscussionPause={() => {
                const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                if (paused) {
                  discussionTTS.pause();
                  setIsDiscussionPaused(true);
                }
              }}
              onDiscussionResume={() => {
                chatAreaRef.current?.resumeActiveLiveBuffer();
                discussionTTS.resume();
                setIsDiscussionPaused(false);
              }}
              totalActions={totalActions}
              currentActionIndex={0}
              currentSceneIndex={currentSceneIndex}
              scenesCount={totalScenesCount}
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={sidebarCollapsed}
              chatCollapsed={chatAreaCollapsed}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
              onPrevSlide={handlePreviousScene}
              onNextSlide={handleNextScene}
              onWhiteboardClose={handleWhiteboardToggle}
              whiteboardEnabled={whiteboardEnabled}
              isPresenting={isPresenting}
              controlsVisible={controlsVisible}
              onTogglePresentation={togglePresentation}
              onPresentationInteractionChange={setIsPresentationInteractionActive}
              fullscreenContainerRef={stageRef}
            />
          </div>
        )}
      </div>

      {/* Chat Area */}
      <ChatArea
        ref={chatAreaRef}
        width={chatAreaWidth}
        onWidthChange={setChatAreaWidth}
        collapsed={chatAreaCollapsed}
        onCollapseChange={setChatAreaCollapsed}
        activeBubbleId={activeBubbleId}
        onActiveBubble={(id) => setActiveBubbleId(id)}
        currentSceneId={currentSceneId}
        onLiveSpeech={(text, agentId) => {
          // Capture epoch at call time — discard if scene has changed since
          const epoch = sceneEpochRef.current;
          // Use queueMicrotask to let any pending scene-switch reset settle first
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return; // stale — scene changed
            setLiveSpeech(text);
            if (agentId !== undefined) {
              setSpeakingAgentId(agentId);
            }
            if (text !== null || agentId) {
              setChatIsStreaming(true);
              setChatSessionType(chatAreaRef.current?.getActiveSessionType?.() ?? null);
              setIsTopicPending(false);
            } else if (text === null && agentId === null) {
              setChatIsStreaming(false);
              // Don't clear chatSessionType here — it's needed by the stop
              // button when director cues user (cue_user → done → liveSpeech null).
              // It gets properly cleared in doSessionCleanup and scene change.
            }
          });
        }}
        onSpeechProgress={(ratio) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setSpeechProgress(ratio);
          });
        }}
        onThinking={(state) => {
          const epoch = sceneEpochRef.current;
          queueMicrotask(() => {
            if (sceneEpochRef.current !== epoch) return;
            setThinkingState(state);
          });
        }}
        onCueUser={(_fromAgentId, _prompt) => {
          setIsCueUser(true);
        }}
        onLiveSessionError={handleLiveSessionError}
        onStopSession={doSessionCleanup}
        onSegmentSealed={discussionTTS.handleSegmentSealed}
        shouldHoldAfterReveal={discussionTTS.shouldHold}
      />

      {/* Scene switch confirmation dialog */}
      <AlertDialog
        open={!!pendingSceneId}
        onOpenChange={(open) => {
          if (!open) cancelSceneSwitch();
        }}
      >
        <AlertDialogContent
          container={isPresenting ? stageRef.current : undefined}
          className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)]"
        >
          <VisuallyHidden.Root>
            <AlertDialogTitle>{t('stage.confirmSwitchTitle')}</AlertDialogTitle>
          </VisuallyHidden.Root>
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

          <div className="px-6 pt-5 pb-2 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4 ring-1 ring-amber-200/50 dark:ring-amber-700/30">
              <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
            {/* Title */}
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">
              {t('stage.confirmSwitchTitle')}
            </h3>
            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('stage.confirmSwitchMessage')}
            </p>
          </div>

          <AlertDialogFooter className="px-6 pb-5 pt-3 flex-row gap-3">
            <AlertDialogCancel onClick={cancelSceneSwitch} className="flex-1 rounded-xl">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSceneSwitch}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
       * Stage-scoped overlays. These live inside the stage root
       * (not as siblings of `<Stage />`) so the browser's
       * fullscreen API keeps them visible: when the root div
       * enters fullscreen, the fullscreen subtree is what the
       * user sees. Anything outside the root is clipped/hidden.
       * `z-50` keeps the overlay above the canvas / sidebar /
       * chat area / floating controls. `pointer-events: auto`
       * is the default for <div> so click handlers on the
       * children fire normally.
       */}
      {topLeftOverlay && (
        <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-2 pointer-events-auto">
          {topLeftOverlay}
        </div>
      )}
      {topRightOverlay && (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-auto">
          {topRightOverlay}
        </div>
      )}
    </div>
      <InteractiveIframeHost />
    </>
  );
}
