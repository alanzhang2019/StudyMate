import type { ExplanationSummary } from './types';

export function buildFallbackExplanationSummary(input: {
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
}): ExplanationSummary {
  const hasAnswer = Boolean(input.studentAnswer?.trim());
  const hasCorrectAnswer = Boolean(input.correctAnswer?.trim());

  return {
    stuckPoint: hasAnswer
      ? '这题主要卡在关键关系还没先找准，所以一下笔就容易算乱。'
      : '这题主要卡在不知道应该先看哪一步，所以会停在开头。 ',
    whyStuck: hasCorrectAnswer
      ? '这类题不是直接代数去算，先要分清已知量、目标量和它们之间的关系。'
      : '很多作业题看起来能直接算，其实要先把题目里的条件关系理顺。',
    howToThink: `先把题目里的关键条件圈出来，再判断是先换算、先列式，还是先找总数。题目是：${input.problemText}`,
    nextTimeTip: '下次遇到同类题，先停一下，把关键关系写出来再下笔。',
    simplifiedExplanation: {
      title: '换个更简单的说法',
      desc1: '这题不是一上来就算，而是先看清题目里谁和谁有关系。',
      desc2: '先把关系找对，再去列式，后面就不会乱。',
    },
  };
}
