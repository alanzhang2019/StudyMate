import { useState, useEffect, useRef, useMemo, useCallback, type RefObject } from 'react';
import { useCanvasStore } from '@/lib/store';

export interface ViewportStyles {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface ViewportPlacementInput {
  canvasWidth: number;
  canvasHeight: number;
  canvasPercentage: number;
  viewportRatio: number;
  viewportSize: number;
}

interface ViewportPlacement {
  scale: number;
  left: number;
  top: number;
}

export function computeViewportPlacement(
  input: ViewportPlacementInput,
): ViewportPlacement | null {
  const { canvasWidth, canvasHeight, canvasPercentage, viewportRatio, viewportSize } = input;

  if (canvasWidth <= 0 || canvasHeight <= 0 || viewportSize <= 0 || viewportRatio <= 0) {
    return null;
  }

  if (canvasHeight / canvasWidth > viewportRatio) {
    const viewportActualWidth = canvasWidth * (canvasPercentage / 100);
    const scale = viewportActualWidth / viewportSize;
    if (scale <= 0) return null;
    return {
      scale,
      left: (canvasWidth - viewportActualWidth) / 2,
      top: (canvasHeight - viewportActualWidth * viewportRatio) / 2,
    };
  }

  const viewportActualHeight = canvasHeight * (canvasPercentage / 100);
  const scale = viewportActualHeight / (viewportSize * viewportRatio);
  if (scale <= 0) return null;
  return {
    scale,
    left: (canvasWidth - viewportActualHeight / viewportRatio) / 2,
    top: (canvasHeight - viewportActualHeight) / 2,
  };
}

/**
 * Hook for managing Canvas viewport size and position
 * Handles viewport scaling, positioning, and Canvas dragging
 */
export function useViewportSize(canvasRef: RefObject<HTMLElement | null>) {
  const [viewportLeft, setViewportLeft] = useState(0);
  const [viewportTop, setViewportTop] = useState(0);

  const canvasPercentage = useCanvasStore.use.canvasPercentage();
  const canvasDragged = useCanvasStore.use.canvasDragged();
  const setCanvasScale = useCanvasStore.use.setCanvasScale();
  const setCanvasDragged = useCanvasStore.use.setCanvasDragged();

  const viewportRatio = useCanvasStore.use.viewportRatio();
  const viewportSize = useCanvasStore.use.viewportSize();

  // Initialize viewport position
  const initViewportPosition = useCallback(() => {
    if (!canvasRef.current) return;
    const canvasWidth = canvasRef.current.clientWidth;
    const canvasHeight = canvasRef.current.clientHeight;
    const placement = computeViewportPlacement({
      canvasWidth,
      canvasHeight,
      canvasPercentage,
      viewportRatio,
      viewportSize,
    });
    if (!placement) {
      // #region debug-point B:viewport-init-skip
      fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'mistake-classroom-regression',
          runId: 'pre',
          hypothesisId: 'B',
          location: 'useViewportSize.ts:init-skip',
          msg: '[DEBUG] viewport init skipped',
          data: {
            canvasWidth,
            canvasHeight,
            canvasPercentage,
            viewportRatio,
            viewportSize,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    // #region debug-point B:viewport-init-apply
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'mistake-classroom-regression',
        runId: 'pre',
        hypothesisId: 'B',
        location: 'useViewportSize.ts:init-apply',
        msg: '[DEBUG] viewport init apply placement',
        data: {
          canvasWidth,
          canvasHeight,
          canvasPercentage,
          viewportRatio,
          viewportSize,
          scale: placement.scale,
          left: placement.left,
          top: placement.top,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setCanvasScale(placement.scale);
    setViewportLeft(placement.left);
    setViewportTop(placement.top);
  }, [canvasRef, canvasPercentage, viewportRatio, viewportSize, setCanvasScale]);

  // Update viewport position
  const setViewportPosition = useCallback(
    (newValue: number, oldValue: number) => {
      if (!canvasRef.current) return;
      const canvasWidth = canvasRef.current.clientWidth;
      const canvasHeight = canvasRef.current.clientHeight;

      if (canvasWidth <= 0 || canvasHeight <= 0) {
        // #region debug-point B:viewport-update-skip
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'mistake-classroom-regression',
            runId: 'pre',
            hypothesisId: 'B',
            location: 'useViewportSize.ts:update-skip',
            msg: '[DEBUG] viewport update skipped',
            data: {
              canvasWidth,
              canvasHeight,
              newValue,
              oldValue,
              viewportRatio,
              viewportSize,
            },
            ts: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        return;
      }

      if (canvasHeight / canvasWidth > viewportRatio) {
        const newViewportActualWidth = canvasWidth * (newValue / 100);
        const oldViewportActualWidth = canvasWidth * (oldValue / 100);
        const newViewportActualHeight = newViewportActualWidth * viewportRatio;
        const oldViewportActualHeight = oldViewportActualWidth * viewportRatio;
        const nextScale = newViewportActualWidth / viewportSize;
        if (nextScale <= 0) return;
        // #region debug-point B:viewport-update-apply-width
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'mistake-classroom-regression',
            runId: 'pre',
            hypothesisId: 'B',
            location: 'useViewportSize.ts:update-apply-width',
            msg: '[DEBUG] viewport update apply width-driven placement',
            data: {
              canvasWidth,
              canvasHeight,
              newValue,
              oldValue,
              nextScale,
            },
            ts: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        setCanvasScale(nextScale);

        setViewportLeft((prev) => prev - (newViewportActualWidth - oldViewportActualWidth) / 2);
        setViewportTop((prev) => prev - (newViewportActualHeight - oldViewportActualHeight) / 2);
      } else {
        const newViewportActualHeight = canvasHeight * (newValue / 100);
        const oldViewportActualHeight = canvasHeight * (oldValue / 100);
        const newViewportActualWidth = newViewportActualHeight / viewportRatio;
        const oldViewportActualWidth = oldViewportActualHeight / viewportRatio;
        const nextScale = newViewportActualHeight / (viewportSize * viewportRatio);
        if (nextScale <= 0) return;
        // #region debug-point B:viewport-update-apply-height
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'mistake-classroom-regression',
            runId: 'pre',
            hypothesisId: 'B',
            location: 'useViewportSize.ts:update-apply-height',
            msg: '[DEBUG] viewport update apply height-driven placement',
            data: {
              canvasWidth,
              canvasHeight,
              newValue,
              oldValue,
              nextScale,
            },
            ts: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        setCanvasScale(nextScale);

        setViewportLeft((prev) => prev - (newViewportActualWidth - oldViewportActualWidth) / 2);
        setViewportTop((prev) => prev - (newViewportActualHeight - oldViewportActualHeight) / 2);
      }
    },
    [canvasRef, viewportRatio, viewportSize, setCanvasScale],
  );

  // Track previous Canvas percentage for detecting changes
  const prevCanvasPercentageRef = useRef(canvasPercentage);

  // Update viewport position when canvas percentage changes
  useEffect(() => {
    if (prevCanvasPercentageRef.current !== canvasPercentage) {
      setViewportPosition(canvasPercentage, prevCanvasPercentageRef.current);
      prevCanvasPercentageRef.current = canvasPercentage;
    }
  }, [canvasPercentage, setViewportPosition]);

  // Reset viewport position when viewport ratio or size changes
  useEffect(() => {
    initViewportPosition();
  }, [viewportRatio, viewportSize, initViewportPosition]);

  // Reset viewport position when drag state is restored
  useEffect(() => {
    if (!canvasDragged) {
      initViewportPosition();
    }
  }, [canvasDragged, initViewportPosition]);

  // Reset viewport position when canvas is resized
  useEffect(() => {
    const el = canvasRef.current;
    const resizeObserver = new ResizeObserver(initViewportPosition);
    if (el) {
      resizeObserver.observe(el);
    }
    return () => {
      if (el) {
        resizeObserver.unobserve(el);
      }
    };
  }, [canvasRef, initViewportPosition]);

  // Drag canvas viewport
  const dragViewport = useCallback(
    (e: React.MouseEvent) => {
      let isMouseDown = true;

      const startPageX = e.pageX;
      const startPageY = e.pageY;

      const originLeft = viewportLeft;
      const originTop = viewportTop;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isMouseDown) return;

        const currentPageX = e.pageX;
        const currentPageY = e.pageY;

        setViewportLeft(originLeft + (currentPageX - startPageX));
        setViewportTop(originTop + (currentPageY - startPageY));
      };

      const handleMouseUp = () => {
        isMouseDown = false;
        document.onmousemove = null;
        document.onmouseup = null;

        setCanvasDragged(true);
      };

      document.onmousemove = handleMouseMove;
      document.onmouseup = handleMouseUp;
    },
    [viewportLeft, viewportTop, setCanvasDragged],
  );

  // Viewport position and size styles
  const viewportStyles: ViewportStyles = useMemo(
    () => ({
      width: viewportSize,
      height: viewportSize * viewportRatio,
      left: viewportLeft,
      top: viewportTop,
    }),
    [viewportSize, viewportRatio, viewportLeft, viewportTop],
  );

  return {
    viewportStyles,
    dragViewport,
  };
}
