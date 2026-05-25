import { useCanvasStore } from '@/lib/store/canvas';

export function resetCanvasForClassroomPlayback() {
  useCanvasStore.getState().resetCanvasState();
}
