import { describe, expect, it } from 'vitest';

import { getMistakeLabel } from '@/lib/mistake/taxonomy/mistake-taxonomy';

describe('getMistakeLabel', () => {
  it('returns the expected chinese labels for every mistake code', () => {
    expect(getMistakeLabel('carry_mistake')).toEqual({
      name: '进位错误',
      description: '加法进位时漏加或进错位。',
      triggers: ['满十进一时忘记进位', '把进位加错到别的数位'],
    });

    expect(getMistakeLabel('borrow_mistake')).toEqual({
      name: '退位错误',
      description: '减法退位时忘记借一或退位后计算错误。',
      triggers: ['个位不够减时没有借位', '借位后没有把原数位减一'],
    });

    expect(getMistakeLabel('operator_confusion')).toEqual({
      name: '运算符混淆',
      description: '把加减乘除或比较关系看错、用错。',
      triggers: ['把加号看成减号', '列式时选错运算'],
    });

    expect(getMistakeLabel('bracket_order_error')).toEqual({
      name: '括号顺序错误',
      description: '没有先算括号内，或运算顺序处理错误。',
      triggers: ['先算了括号外', '没有按从左到右和先乘除后加减计算'],
    });

    expect(getMistakeLabel('unit_conversion_error')).toEqual({
      name: '单位换算错误',
      description: '长度、重量、时间等单位之间换算出错。',
      triggers: ['大单位和小单位进率记错', '换算后漏写或写错单位'],
    });

    expect(getMistakeLabel('concept_gap')).toEqual({
      name: '概念理解不足',
      description: '对题目涉及的基础概念还没有真正理解。',
      triggers: ['不知道题目在考什么概念', '会套步骤但说不清原因'],
    });
  });
});
