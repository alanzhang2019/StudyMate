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
  const correctAnswer = normalizeText(input.correctAnswer);
  const studentName = normalizeText(input.studentName) || '同学';

  return [
    `请为小学${input.grade}年级学生${studentName}讲解这道数学题：${problemText}`,
    `学生答案：${studentAnswer ?? '未提供'}`,
    `正确答案：${correctAnswer ?? '未提供'}`,
  ].join('\n');
}
