import { describe, expect, it } from 'vitest';

import { getHomeworkHomeContent } from '@/lib/mistake/ui/content';

describe('getHomeworkHomeContent', () => {
  it('returns the homework-entry copy contract for the mistake home page', () => {
    const content = getHomeworkHomeContent((key: string) => key);

    expect(content).toEqual({
      title: 'homeworkHome.title',
      subtitle: 'homeworkHome.subtitle',
      ctaPrimary: 'homeworkHome.ctaPrimary',
      ctaSecondary: 'homeworkHome.ctaSecondary',
      sceneHint: 'homeworkHome.sceneHint',
      values: ['homeworkHome.value1', 'homeworkHome.value2', 'homeworkHome.value3'],
      uploadHint: 'homeworkHome.uploadHint',
      uploadTip: 'homeworkHome.uploadTip',
      parentHint: 'homeworkHome.parentHint',
      emptyTitle: 'homeworkHome.emptyTitle',
      emptyDesc: 'homeworkHome.emptyDesc',
    });
  });
});
