import { after, type NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { buildMistakeClassroomRequirement } from '@/lib/mistake/openmaic/build-requirement';
import type { MistakeClassroomInput } from '@/lib/mistake/openmaic/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';

const requestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  grade: z.number().int().min(4).max(6),
  subject: z.literal('math'),
  source: z.union([z.literal('photo'), z.literal('manual')]),
  problemText: z.string().min(1),
  studentAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
  studentName: z.string().optional(),
  teachingStyle: z.string().optional(),
});

export const maxDuration = 30;

function resolveMistakeClassroomModelString(): string | undefined {
  return process.env.MISTAKE_CLASSROOM_MODEL || process.env.MISTAKE_OCR_MODEL || process.env.DEFAULT_MODEL;
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求体必须是合法 JSON');
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, '请求体字段不合法');
  }

  try {
    const input: MistakeClassroomInput = parsed.data;
    const requirement = buildMistakeClassroomRequirement(input);
    const classroomInput: GenerateClassroomInput = {
      requirement,
      userNickname: input.studentName,
      ...(resolveMistakeClassroomModelString()
        ? { modelString: resolveMistakeClassroomModelString() }
        : {}),
      maxScenes: 1, // Only generate 1 scene since it's single-problem focused
      enableImageGeneration: false,
      enableVideoGeneration: true,
      enableTTS: true,
      agentMode: 'default' as const,
    };

    const baseUrl = buildRequestOrigin(req);
    const jobId = nanoid(10);
    const job = await createClassroomGenerationJob(jobId, classroomInput, {
      sessionId: input.sessionId,
    });
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    after(() => runClassroomGenerationJob(jobId, classroomInput, baseUrl, { sessionId: input.sessionId }));

    return apiSuccess(
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
        requirementPreview: requirement,
      },
      202,
    );
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      '错题任务创建失败',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
