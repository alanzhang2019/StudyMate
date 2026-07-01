import type { MathMistakeCode } from '@/lib/mistake/domain/types';
import { getMistakeLabel } from '@/lib/mistake/taxonomy';

export function explainMathForChild(code: MathMistakeCode, _problemText?: string): string {
  if (code === 'concept_gap') {
    return `这道题不只是算错，更像是${getMistakeLabel(code).name}。先把题目在问什么、已知什么说清楚，再开始列式。`;
  }

  const explanationMap: Record<Exclude<MathMistakeCode, 'concept_gap'>, string> = {
    carry_mistake:
      '这道题像是在加法进位时漏掉了前一位要多加 1。先把个位相加，满十以后把 1 送到十位，再算十位会更稳。',
    borrow_mistake:
      '这道题可能是在减法退位时忘了先借 1。先看看个位够不够减，不够就向前一位借，再继续算。',
    operator_confusion:
      '你可能把要用的运算看混了。先判断题目是在求一共、剩下、几倍还是平均分，再选加减乘除。',
    bracket_order_error:
      '这道题要先算括号里面，或者先按正确顺序算。把第一步圈出来，再一步一步往后做，就不容易乱。',
    unit_conversion_error: '这道题更像是单位换算出了问题。先把单位统一，再开始算，这样结果会更准确。',
  };

  return explanationMap[code];
}
