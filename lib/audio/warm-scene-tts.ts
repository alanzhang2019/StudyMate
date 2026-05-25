import type { SpeechAction } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';

export interface SceneTTSWarmupResult {
  timedOut: boolean;
  totalSpeechActions: number;
  failedCount: number;
}

interface WarmSceneTTSWithinBudgetParams {
  scene: Pick<Scene, 'order' | 'actions'>;
  language?: string;
  budgetMs: number;
  generate: (input: { audioId: string; text: string; language?: string }) => Promise<void>;
  onError?: (input: { audioId: string; error: unknown }) => void;
}

function isSpeechAction(action: any): action is SpeechAction {
  return action?.type === 'speech' && typeof action?.text === 'string' && action.text.trim().length > 0;
}

export async function warmSceneTTSWithinBudget(
  params: WarmSceneTTSWithinBudgetParams,
): Promise<SceneTTSWarmupResult> {
  const speechActions = (params.scene.actions ?? []).filter(isSpeechAction);
  if (speechActions.length === 0) {
    return {
      timedOut: false,
      totalSpeechActions: 0,
      failedCount: 0,
    };
  }

  let failedCount = 0;
  for (const action of speechActions) {
    action.audioId = `tts_s${params.scene.order}_${action.id}`;
  }

  const generationTasks = speechActions.map(async (action) => {
    try {
      await params.generate({
        audioId: action.audioId as string,
        text: action.text,
        language: params.language,
      });
    } catch (error) {
      failedCount += 1;
      params.onError?.({ audioId: action.audioId as string, error });
    }
  });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const completedPromise = Promise.all(generationTasks).then(() => ({
    timedOut: false,
    totalSpeechActions: speechActions.length,
    failedCount,
  }));

  const timeoutPromise = new Promise<SceneTTSWarmupResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({
        timedOut: true,
        totalSpeechActions: speechActions.length,
        failedCount,
      });
    }, params.budgetMs);
  });

  const result = await Promise.race([completedPromise, timeoutPromise]);
  if (!result.timedOut && timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}
