import type { Scene } from '@/lib/types/stage';

export function shouldShowCanvasPlayHint(input: {
  showControls: boolean;
  engineState: string;
  sceneType?: Scene['type'];
  isLiveSession: boolean;
  isPendingScene: boolean;
  hasVisibleLectureContent: boolean;
}) {
  return (
    input.showControls &&
    input.engineState !== 'playing' &&
    input.sceneType === 'slide' &&
    !input.isLiveSession &&
    !input.isPendingScene &&
    !input.hasVisibleLectureContent
  );
}
