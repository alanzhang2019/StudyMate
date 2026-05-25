import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readMistakeSession, updateMistakeSession } from '@/lib/mistake/session/store';
import { apiError, apiSuccess } from '@/lib/server/api-response';

const patchSchema = z.object({
  classroomId: z.string().min(1).optional(),
  status: z
    .union([
      z.literal('draft'),
      z.literal('ready_to_generate'),
      z.literal('waiting_first_scene'),
      z.literal('live'),
      z.literal('failed'),
      z.literal('completed'),
    ])
    .optional(),
  explanationSummary: z
    .object({
      stuckPoint: z.string().min(1),
      whyStuck: z.string().min(1),
      howToThink: z.string().min(1),
      nextTimeTip: z.string().min(1),
      simplifiedExplanation: z
        .object({
          title: z.string().min(1),
          desc1: z.string().min(1),
          desc2: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
  parentSummary: z
    .object({
      totalCount: z.number().int().nonnegative(),
      solvedCount: z.number().int().nonnegative(),
      needMoreReason: z.string().min(1),
      focusTopic: z.string().min(1),
    })
    .optional(),
  masteryStatus: z.union([z.literal('pending'), z.literal('done')]).optional(),
  error: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await readMistakeSession(id);

  if (!session) {
    return apiError('INVALID_REQUEST', 404, '错题会话不存在');
  }

  return apiSuccess({ session });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await readMistakeSession(id);

  if (!existing) {
    return apiError('INVALID_REQUEST', 404, '错题会话不存在');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求体必须是合法 JSON');
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, '更新字段不合法');
  }

  const session = await updateMistakeSession(id, parsed.data);
  return apiSuccess({ session });
}
