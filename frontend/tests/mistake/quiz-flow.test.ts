import { describe, expect, it } from 'vitest';

import { buildHomeworkQuiz } from '@/lib/mistake/ui/quiz';

describe('buildHomeworkQuiz', () => {
  it('returns exactly one quiz question for the homework-entry flow', () => {
    const quiz = buildHomeworkQuiz({
      problemText: '2 米减去 80 厘米还剩多少厘米？',
      correctAnswer: '120 厘米',
    });

    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]?.title).toBe('第 1 题');
    expect(quiz.questions[0]?.expectedAnswer).toBe('120 厘米');
  });
});
