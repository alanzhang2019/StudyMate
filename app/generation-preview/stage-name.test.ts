import { describe, expect, it } from 'vitest';

import { buildInitialStageName } from '@/app/generation-preview/stage-name';

describe('buildInitialStageName', () => {
  it('uses a compact mistake classroom title instead of echoing the full requirement', () => {
    expect(
      buildInitialStageName({
        requirement:
          '【核心诉求】 请为一名小学4年级学生讲解这道作业题。 【错题信息】 题干：36 + 27 = ?',
        mistakeSessionId: 'mistake-1',
      }),
    ).toBe('题目讲解');
  });

  it('falls back to the trimmed requirement for regular generation sessions', () => {
    expect(
      buildInitialStageName({
        requirement: '讲解光合作用',
      }),
    ).toBe('讲解光合作用');
  });
});
