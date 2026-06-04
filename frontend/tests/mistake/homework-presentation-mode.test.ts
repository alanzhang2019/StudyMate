import { describe, expect, it } from 'vitest';

import { shouldUseHomeworkPresentationMode } from '@/lib/mistake/ui/homework-presentation-mode';

describe('shouldUseHomeworkPresentationMode', () => {
  it('enables presentation mode for homework classrooms', () => {
    expect(
      shouldUseHomeworkPresentationMode({
        hasMistakeSession: true,
        stageName: '',
      }),
    ).toBe(true);
  });

  it('keeps standard classrooms unchanged', () => {
    expect(
      shouldUseHomeworkPresentationMode({
        hasMistakeSession: false,
        stageName: '普通课堂',
      }),
    ).toBe(false);
  });

  it('enables presentation mode when the stage prompt identifies a mistake classroom', () => {
    expect(
      shouldUseHomeworkPresentationMode({
        hasMistakeSession: false,
        stageName: '请围绕以下一题小学数学错题生成一个简短、单题聚焦的讲解课堂',
      }),
    ).toBe(true);
  });
});
