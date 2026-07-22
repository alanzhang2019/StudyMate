'use client';

import { useEffect } from 'react';
import Canvas from './Canvas';
import type { StageMode, SlideContent } from '@/lib/types/stage';
import { ScreenCanvas } from './ScreenCanvas';
import { useCanvasStore } from '@/lib/store';
import { useStageStore } from '@/lib/store/stage';

/**
 * Slide Editor - wraps Canvas with SceneProvider.
 *
 * In playback mode the screen renderer reads `viewportSize` / `viewportRatio`
 * from the global canvas store, but each slide scene can carry its own values
 * in `content.canvas.{viewportSize,viewportRatio}` (e.g. an OpenMAIC export
 * with a non-default aspect ratio, or an imported classroom that bypasses
 * the editor). When the scene switches we must sync those values into the
 * canvas store, otherwise `useViewportSize` will compute `canvasScale`
 * against the stale defaults and the slide either overflows the container
 * (no scale applied) or collapses to a thin strip.
 */
function useSyncCanvasViewportFromCurrentScene() {
  const currentScene = useStageStore((state) =>
    state.currentSceneId
      ? state.scenes.find((s) => s.id === state.currentSceneId) ?? null
      : null,
  );

  useEffect(() => {
    if (!currentScene || currentScene.type !== 'slide') return;
    const content = currentScene.content as SlideContent;
    const slide = content?.canvas;
    if (!slide) return;

    const store = useCanvasStore.getState();
    const nextSize = slide.viewportSize;
    const nextRatio = slide.viewportRatio;
    if (
      typeof nextSize === 'number' &&
      nextSize > 0 &&
      nextSize !== store.viewportSize
    ) {
      useCanvasStore.setState({ viewportSize: nextSize });
    }
    if (
      typeof nextRatio === 'number' &&
      nextRatio > 0 &&
      nextRatio !== store.viewportRatio
    ) {
      useCanvasStore.setState({ viewportRatio: nextRatio });
    }
  }, [currentScene]);
}

/**
 * Slide Editor - wraps Canvas with SceneProvider
 */
export function SlideEditor({ mode }: { readonly mode: StageMode }) {
  // Keep canvas store viewport in sync with the active slide scene so the
  // screen renderer (and any future editor) uses the right scale and aspect.
  useSyncCanvasViewportFromCurrentScene();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        {mode === 'autonomous' ? <Canvas /> : <ScreenCanvas />}
      </div>
    </div>
  );
}
