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
    `请为一名小学${input.grade}年级学生（姓名：${input.studentName ?? '同学'}）讲解这道错题。`,
    `期望的教学风格：${input.teachingStyle ?? '清晰易懂'}。`,
    '',
    '【错题信息】',
    `题干：${problemText}`,
    `学生答案：${studentAnswer ?? '未提供'}`
  ].join('\n');
}
