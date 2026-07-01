import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { createMistakeSession } from '@/lib/mistake/session/store';
import { apiError, apiSuccess } from '@/lib/server/api-response';

const requestSchema = z.object({
  subject: z.union([z.literal('math'), z.literal('cpp')]).optional(),
  studentProfileId: z.string().optional(),
  source: z.union([z.literal('photo'), z.literal('upload'), z.literal('integration')]),
  imageUrl: z.string().optional(),
  ocr: z.object({
    problemText: z.string().min(1),
    studentAnswer: z.string().optional(),
    correctAnswerCandidate: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  confirmed: z.object({
    problemText: z.string().min(1),
    studentAnswer: z.string().optional(),
    correctAnswer: z.string().optional(),
  }),
  status: z.union([
    z.literal('draft'),
    z.literal('ready_to_generate'),
    z.literal('waiting_first_scene'),
    z.literal('live'),
    z.literal('failed'),
    z.literal('completed'),
  ]),
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求体必须是合法 JSON');
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, '请求体字段不合法');
  }

  const session = await createMistakeSession(parsed.data);

  return apiSuccess(
    {
      session,
      liveUrl: `${new URL(request.url).origin}/mistake/session/${session.id}`,
    },
    201,
  );
}
