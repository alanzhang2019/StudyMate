import type { PendingRecognizeSession } from '@/lib/mistake/ui/recognize-session';

export function shouldShowRecognizeFailure(pending: PendingRecognizeSession | null) {
  if (!pending) {
    return true;
  }

  return pending.problemText.trim().length === 0;
}
