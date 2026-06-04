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

function isSpeechAction(action: unknown): action is SpeechAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    (action as { type: string }).type === 'speech' &&
    'text' in action &&
    typeof (action as { text: string }).text === 'string' &&
    (action as { text: string }).text.trim().length > 0
  );
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

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const completedPromise = (async () => {
    const concurrency = 2;
    let active = 0;
    const queue: Array<() => void> = [];
    const gate = () => {
      if (queue.length > 0 && active < concurrency) {
        active++;
        queue.shift()!();
      }
    };

    await Promise.all(
      speechActions.map(
        (action) =>
          new Promise<void>((resolve) => {
            const run = async () => {
              try {
                await params.generate({
                  audioId: action.audioId as string,
                  text: action.text,
                  language: params.language,
                });
              } catch (error) {
                failedCount += 1;
                params.onError?.({ audioId: action.audioId as string, error });
              } finally {
                active--;
                gate();
                resolve();
              }
            };
            if (active < concurrency) {
              active++;
              run();
            } else {
              queue.push(run);
            }
          }),
      ),
    );

    return {
      timedOut: false,
      totalSpeechActions: speechActions.length,
      failedCount,
    };
  })();

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
