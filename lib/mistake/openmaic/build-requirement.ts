import type { MistakeClassroomInput } from './types';

function normalizeText(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildMistakeClassroomRequirement(input: MistakeClassroomInput): string {
  const problemText = normalizeText(input.problemText);

  if (!problemText) {
    throw new Error('problemText is required');
  }

  const studentAnswer = normalizeText(input.studentAnswer);

  return [
    '【核心诉求】',
    `请为一名小学${input.grade}年级学生（姓名：${input.studentName ?? '同学'}）讲解这道作业题。`,
    `期望的教学风格：${input.teachingStyle ?? '清晰易懂'}。`,
    '讲解过程中统一使用“作业讲解”或“题目讲解”这样的说法，不要把本次课件命名为“错题回顾”或“错题讲解”。',
    '如适合，可安排 1 页互动演示或数学模拟，帮助学生直观看懂关键步骤；若加入互动页，应让互动内容尽量独占一页，不要与大段文字挤在一起。',
    '',
    '【错题信息】',
    `题干：${problemText}`,
    `学生答案：${studentAnswer ?? '未提供'}`,
    `正确答案：${input.correctAnswer ?? '未提供'}`
  ].join('\n');
}
