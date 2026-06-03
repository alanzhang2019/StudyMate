import { describe, expect, it } from 'vitest';

import { buildMistakeClassroomRequirement } from '@/lib/mistake/openmaic/build-requirement';

describe('buildMistakeClassroomRequirement', () => {
  it('builds a concise free-form requirement without mistake-specific prompt scaffolding', () => {
    const requirement = buildMistakeClassroomRequirement({
      grade: 4,
      subject: 'math',
      source: 'manual',
      problemText: '一项工程，甲干3天、乙干5天完成1/2；甲干5天、乙干3天完成1/3。问：甲乙合干需几天完成？',
      studentAnswer: '8天',
      correctAnswer: '7.5天',
      studentName: '小明',
      teachingStyle: '清晰易懂',
    });

    expect(requirement).toContain('一项工程');
    expect(requirement).toContain('学生答案：8天');
    expect(requirement).toContain('正确答案：7.5天');
    expect(requirement).not.toContain('【核心诉求】');
    expect(requirement).not.toContain('【错题信息】');
    expect(requirement).not.toContain('讲解过程中统一使用');
    expect(requirement).not.toContain('互动演示');
  });
});
