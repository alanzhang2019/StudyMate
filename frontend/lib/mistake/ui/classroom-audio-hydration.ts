import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';

export function needsServerAudioHydration(scenes: Scene[]) {
  return scenes.some((scene) =>
    (scene.actions ?? []).some((action) => {
      if (action.type !== 'speech') {
        return false;
      }

      const speechAction = action as SpeechAction;
      return Boolean(speechAction.audioId && !speechAction.audioUrl);
    }),
  );
}
