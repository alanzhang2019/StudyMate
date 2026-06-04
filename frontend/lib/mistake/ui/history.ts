import type { HomeworkHistoryStatus } from './types';

export type HomeworkHistoryItem = {
  id: string;
  problemPreview: string;
  status: HomeworkHistoryStatus;
  updatedAt: number;
  explanationId: string;
};

export function groupHomeworkHistory(items: HomeworkHistoryItem[]) {
  return {
    pending: items.filter((item) => item.status === 'pending'),
    done: items.filter((item) => item.status === 'done'),
  };
}
