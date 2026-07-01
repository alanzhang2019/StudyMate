import { z } from 'zod';

import type { AnalyzeSessionResponse, ProblemInput } from '@/lib/mistake/domain/types';
import { diagnoseMistake } from '@/lib/mistake/diagnosis';
import { explainForChild } from '@/lib/mistake/explain';
import { generatePractice } from '@/lib/mistake/practice';
import { trackEvent } from '@/lib/usage/track';

const problemInputSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.union([z.literal('math'), z.literal('cpp')]),
  source: z.union([z.literal('photo'), z.literal('manual'), z.literal('integration')]),
  problemText: z.string().min(1),
  studentAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
  verdict: z
    .union([
      z.literal('AC'), z.literal('WA'), z.literal('TLE'),
      z.literal('RE'), z.literal('CE'), z.literal('MLE'), z.literal('PE'),
    ])
    .optional(),
  problemType: z
    .union([
      z.literal('dp'), z.literal('greedy'), z.literal('brute'),
      z.literal('graph'), z.literal('string'), z.literal('math'), z.literal('other'),
    ])
    .optional(),
  title: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const parsed = problemInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: '请求体字段不合法',
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const input: ProblemInput = parsed.data;
  const diagnosis = diagnoseMistake(input);
  const response: AnalyzeSessionResponse = {
    input: {
      ...input,
      problemText: diagnosis.normalizedProblemText,
    },
    diagnosis: {
      normalizedProblemText: diagnosis.normalizedProblemText,
      guessedMistake: diagnosis.guessedMistake,
      confidence: diagnosis.confidence,
      explanationForChild: explainForChild(diagnosis.guessedMistake, diagnosis.normalizedProblemText),
      knowledgePoint: diagnosis.knowledgePoint,
      practiceSuggestions: generatePractice(diagnosis.guessedMistake),
      parentSummary: diagnosis.parentSummary,
    },
  };

  void trackEvent('mistake.session.analyze', {
    grade: input.grade,
    hasStudentAnswer: Boolean(input.studentAnswer),
    confidence: diagnosis.confidence,
  }, { request });

  return Response.json(response);
}
