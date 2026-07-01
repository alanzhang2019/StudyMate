import { describe, expect, it } from 'vitest';

import { diagnoseMistake } from '@/lib/mistake/diagnosis';

describe('diagnoseMistake', () => {
  it('detects carry_mistake from normalized addition text and answer gap', () => {
    const result = diagnoseMistake({
      grade: 4,
      subject: 'math',
      source: 'manual',
      problemText: '  36 + 27 = 53  ',
      studentAnswer: '53',
      correctAnswer: '63',
    });

    expect(result).toEqual({
      normalizedProblemText: '36 + 27 = 53',
      guessedMistake: 'carry_mistake',
      confidence: 0.88,
      knowledgePoint: '进位错误',
      parentSummary: {
        headline: '本次错题更接近“进位错误”。',
        nextStep: '优先复习“进位错误”，并完成 2 道同类题验证是否真正改正。',
      },
    });
  });

  it('does not detect carry_mistake when answer gap is 10 but the addition has no carry', () => {
    const result = diagnoseMistake({
      grade: 4,
      subject: 'math',
      source: 'manual',
      problemText: '21 + 32 = 43',
      studentAnswer: '43',
      correctAnswer: '53',
    });

    expect(result).toEqual({
      normalizedProblemText: '21 + 32 = 43',
      guessedMistake: 'concept_gap',
      confidence: 0.6,
      knowledgePoint: '概念理解不足',
      parentSummary: {
        headline: '本次错题更接近“概念理解不足”。',
        nextStep: '优先复习“概念理解不足”，并完成 2 道同类题验证是否真正改正。',
      },
    });
  });

  it('detects unit_conversion_error from a real conversion mistake example', () => {
    const result = diagnoseMistake({
      grade: 5,
      subject: 'math',
      source: 'manual',
      problemText: '3米等于多少厘米？我写成了30厘米',
      studentAnswer: '30',
      correctAnswer: '300',
    });

    expect(result).toEqual({
      normalizedProblemText: '3米等于多少厘米？我写成了30厘米',
      guessedMistake: 'unit_conversion_error',
      confidence: 0.73,
      knowledgePoint: '单位换算错误',
      parentSummary: {
        headline: '本次错题更接近“单位换算错误”。',
        nextStep: '优先复习“单位换算错误”，并完成 2 道同类题验证是否真正改正。',
      },
    });
  });

  it('does not detect unit_conversion_error from a single unit word without conversion meaning', () => {
    const result = diagnoseMistake({
      grade: 5,
      subject: 'math',
      source: 'manual',
      problemText: '这支铅笔长5厘米',
    });

    expect(result).toEqual({
      normalizedProblemText: '这支铅笔长5厘米',
      guessedMistake: 'concept_gap',
      confidence: 0.6,
      knowledgePoint: '概念理解不足',
      parentSummary: {
        headline: '本次错题更接近“概念理解不足”。',
        nextStep: '优先复习“概念理解不足”，并完成 2 道同类题验证是否真正改正。',
      },
    });
  });

  it('falls back to concept_gap when no heuristic matches', () => {
    const result = diagnoseMistake({
      grade: 6,
      subject: 'math',
      source: 'manual',
      problemText: '这道题我还是不会做',
    });

    expect(result).toEqual({
      normalizedProblemText: '这道题我还是不会做',
      guessedMistake: 'concept_gap',
      confidence: 0.6,
      knowledgePoint: '概念理解不足',
      parentSummary: {
        headline: '本次错题更接近“概念理解不足”。',
        nextStep: '优先复习“概念理解不足”，并完成 2 道同类题验证是否真正改正。',
      },
    });
  });
});
