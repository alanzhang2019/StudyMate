'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStageStore } from '@/lib/store';

interface GenerationProgress {
  /** Current scene being generated (1-based) */
  currentScene: number;
  /** Total scenes to generate */
  totalScenes: number;
  /** Number of scenes already completed */
  completedScenes: number;
  /** Estimated remaining time in seconds */
  estimatedRemainingSeconds: number;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Current phase: content, actions, tts */
  currentPhase: string;
}

// Average time per scene based on model and history
const DEFAULT_SCENE_TIME_SECONDS = 45; // Conservative estimate for Qwen3-8B
const PHASE_WEIGHTS = {
  content: 0.5,    // 50% of time
  actions: 0.35,   // 35% of time
  tts: 0.15,       // 15% of time
};

/**
 * Hook to track generation progress and provide countdown timer
 */
export function useGenerationProgress(): GenerationProgress {
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const scenes = useStageStore((s) => s.scenes);
  const outlines = useStageStore((s) => s.outlines);
  const generationStatus = useStageStore((s) => s.generationStatus);
  const currentGeneratingOrder = useStageStore((s) => s.currentGeneratingOrder);

  const [progress, setProgress] = useState<GenerationProgress>({
    currentScene: 0,
    totalScenes: 0,
    completedScenes: 0,
    estimatedRemainingSeconds: 0,
    isGenerating: false,
    currentPhase: 'content',
  });

  const startTimeRef = useRef<number>(0);
  const sceneStartTimeRef = useRef<number>(0);
  const completedTimesRef = useRef<number[]>([]);

  const isGenerating = generationStatus === 'generating';

  useEffect(() => {
    if (isGenerating && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    } else if (!isGenerating) {
      startTimeRef.current = 0;
      sceneStartTimeRef.current = 0;
      completedTimesRef.current = [];
    }
  }, [isGenerating]);

  // Track when a new scene starts generating
  useEffect(() => {
    if (isGenerating && currentGeneratingOrder >= 0) {
      const now = Date.now();
      // If we were working on a previous scene, record its completion time
      if (sceneStartTimeRef.current > 0) {
        const elapsed = (now - sceneStartTimeRef.current) / 1000;
        completedTimesRef.current.push(elapsed);
      }
      sceneStartTimeRef.current = now;
    }
  }, [isGenerating, currentGeneratingOrder]);

  // Calculate progress and countdown
  useEffect(() => {
    if (!isGenerating) {
      setProgress((prev) => ({
        ...prev,
        isGenerating: false,
        estimatedRemainingSeconds: 0,
      }));
      return;
    }

    const totalScenes = outlines.length;
    const completedScenes = scenes.length;
    const pendingScenes = generatingOutlines.length;
    const currentScene = completedScenes + 1;

    // Calculate average time per scene from history
    const avgSceneTime =
      completedTimesRef.current.length > 0
        ? completedTimesRef.current.reduce((a, b) => a + b, 0) /
          completedTimesRef.current.length
        : DEFAULT_SCENE_TIME_SECONDS;

    // Estimate remaining time
    const remainingScenes = pendingScenes;
    const estimatedRemainingSeconds = Math.round(remainingScenes * avgSceneTime);

    // Determine current phase based on time elapsed in current scene
    let currentPhase = 'content';
    if (sceneStartTimeRef.current > 0) {
      const sceneElapsed = (Date.now() - sceneStartTimeRef.current) / 1000;
      const sceneProgress = sceneElapsed / avgSceneTime;
      if (sceneProgress > PHASE_WEIGHTS.content + PHASE_WEIGHTS.actions) {
        currentPhase = 'tts';
      } else if (sceneProgress > PHASE_WEIGHTS.content) {
        currentPhase = 'actions';
      }
    }

    setProgress({
      currentScene,
      totalScenes,
      completedScenes,
      estimatedRemainingSeconds: Math.max(0, estimatedRemainingSeconds),
      isGenerating: true,
      currentPhase,
    });
  }, [isGenerating, scenes.length, outlines.length, generatingOutlines.length]);

  // Countdown timer
  useEffect(() => {
    if (!isGenerating || progress.estimatedRemainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setProgress((prev) => ({
        ...prev,
        estimatedRemainingSeconds: Math.max(0, prev.estimatedRemainingSeconds - 1),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, progress.estimatedRemainingSeconds]);

  return progress;
}

/**
 * Format seconds into human-readable string
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '即将完成...';
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}分钟`;
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * Get phase display text
 */
export function getPhaseText(phase: string): string {
  switch (phase) {
    case 'content':
      return '生成内容';
    case 'actions':
      return '编排动作';
    case 'tts':
      return '合成语音';
    default:
      return '生成中';
  }
}
