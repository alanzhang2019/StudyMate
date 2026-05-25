export type HomeworkQuizQuestion = {
  id: string;
  title: string;
  hint: string;
  stem: string;
  expectedAnswer?: string;
};

export function buildHomeworkQuiz(input: { problemText: string; correctAnswer?: string }) {
  return {
    questions: [
      {
        id: 'q1',
        title: '第 1 题',
        hint: '这题和刚才很像，先自己想一想。',
        stem: `同类题练习：${input.problemText}`,
        expectedAnswer: input.correctAnswer,
      },
    ] satisfies HomeworkQuizQuestion[],
  };
}

export function normalizeHomeworkAnswer(value: string) {
  return value.replace(/\s+/g, '').trim();
}
