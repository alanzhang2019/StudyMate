import { describe, expect, it } from 'vitest';

import { resetCanvasForClassroomPlayback } from '@/lib/mistake/ui/classroom-canvas-reset';
import { useCanvasStore } from '@/lib/store/canvas';

describe('resetCanvasForClassroomPlayback', () => {
  it('clears whiteboard and visual effects while preserving viewport settings', () => {
    useCanvasStore.setState({
      whiteboardOpen: true,
      spotlightElementId: 'el-1',
      spotlightOptions: { dimness: 0.9 },
      highlightedElementIds: ['el-1', 'el-2'],
      highlightOptions: { color: '#fff000' },
      zoomTarget: { elementId: 'el-3', scale: 2.5 },
      canvasScale: 0.01,
      viewportSize: 1000,
      viewportRatio: 0.5625,
    });

    resetCanvasForClassroomPlayback();

    const state = useCanvasStore.getState();
    expect(state.whiteboardOpen).toBe(false);
    expect(state.spotlightElementId).toBe('');
    expect(state.highlightedElementIds).toEqual([]);
    expect(state.zoomTarget).toBeNull();
    expect(state.canvasScale).toBe(0.01);
    expect(state.viewportSize).toBe(1000);
    expect(state.viewportRatio).toBe(0.5625);
  });
});
