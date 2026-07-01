import { z } from 'zod';

export const SUBJECTS = ['math', 'cpp'] as const;
export const VERDICTS = ['AC', 'WA', 'TLE', 'RE', 'CE', 'MLE', 'PE'] as const;
export const PROBLEM_TYPES = ['dp', 'greedy', 'brute', 'graph', 'string', 'math', 'other'] as const;

export const MAX_PROBLEM_CHARS = 8000;
export const MAX_ANSWER_CHARS = 4000;
export const MAX_TITLE_CHARS = 200;
export const MAX_SOURCE_CHARS = 64;

export const createMistakeJobSchema = z.object({
  subject: z.literal('cpp'),
  grade: z.number().int().min(1).max(12),
  verdict: z.enum(VERDICTS),
  problemText: z.string().min(1).max(MAX_PROBLEM_CHARS),
  studentAnswer: z.string().max(MAX_ANSWER_CHARS).optional(),
  correctAnswer: z.string().max(MAX_ANSWER_CHARS).optional(),
  problemType: z.enum(PROBLEM_TYPES).optional(),
  title: z.string().max(MAX_TITLE_CHARS).optional(),
  source: z.string().max(MAX_SOURCE_CHARS).optional(),
});

export type CreateMistakeJobInput = z.infer<typeof createMistakeJobSchema>;
