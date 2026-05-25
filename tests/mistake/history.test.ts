import { describe, expect, it } from 'vitest';

import { groupHomeworkHistory } from '@/lib/mistake/ui/history';

describe('groupHomeworkHistory', () => {
  it('splits sessions into pending and done groups', () => {
    const grouped = groupHomeworkHistory([
      { id: 'a', problemPreview: '题目 A', status: 'pending', updatedAt: 1, explanationId: 'e1' },
      { id: 'b', problemPreview: '题目 B', status: 'done', updatedAt: 2, explanationId: 'e2' },
    ]);

    expect(grouped.pending).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
  });
});
