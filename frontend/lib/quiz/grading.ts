import type { QuizQuestion } from '@/lib/types/stage';

export interface QuestionResult {
  questionId: string;
  correct: boolean | null;
  status: 'correct' | 'incorrect';
  earned: number;
  aiComment?: string;
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function isShortAnswer(q: QuizQuestion): boolean {
  // "code_section" sentinels are NOT real questions — they are
  // visual dividers that the SceneRenderer inserts into the
  // questions array so a 真题卷 can be rendered as one long
  // page. They must be skipped everywhere we iterate over
  // "real" questions (local grading, AI short-answer batching,
  // progress reporting, results map, etc.). Without this guard
  // the AI grader would send "fill in ① ② ③ ..." to the LLM
  // and the local grader would treat a missing `answer` as a
  // blank that deserves zero points.
  if (q.type === 'code_section') return false;
  return q.type === 'short_answer' || (!q.hasAnswer && (!q.answer || q.answer.length === 0));
}

/** Filter out non-answerable sentinels (e.g. "code_section" dividers). */
export function isAnswerable(q: QuizQuestion): boolean {
  return q.type !== 'code_section';
}

/** Grade choice questions locally. Returns results only for non-short-answer questions. */
export function gradeChoiceQuestions(
  questions: QuizQuestion[],
  answers: Record<string, string | string[]>,
): QuestionResult[] {
  return questions
    .filter((q) => !isShortAnswer(q) && isAnswerable(q))
    .map((q) => {
      const pts = q.points ?? 1;
      const userAnswer = toArray(answers[q.id]);
      const correctAnswer = toArray(q.answer);
      const correct = arraysEqual(userAnswer, correctAnswer);
      return {
        questionId: q.id,
        correct,
        status: correct ? ('correct' as const) : ('incorrect' as const),
        earned: correct ? pts : 0,
      };
    });
}
