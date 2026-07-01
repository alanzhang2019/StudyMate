import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { trackEvent } from '@/lib/usage/track';
import { createMistakeJobSchema } from '@/lib/integrations/schemas';
import { createIntegrationJob } from '@/lib/integrations/store';
import { runIntegrationJob } from '@/lib/integrations/runner';
import { checkRateLimit, getClientIp } from '@/lib/integrations/rate-limit';
import { RateLimitedError } from '@/lib/integrations/errors';

const CREATE_LIMIT = Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10);

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);

  try {
    checkRateLimit(`create:${ip}`, CREATE_LIMIT, 60_000);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return NextResponse.json(
        { success: false, errorCode: 'RATE_LIMITED', error: err.message, retryAfter: err.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSec) } },
      );
    }
    throw err;
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return apiError('INVALID_REQUEST', 415, 'Content-Type must be application/json');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, '请求体必须是合法 JSON');
  }

  const parsed = createMistakeJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: '请求体字段不合法', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const job = createIntegrationJob({
    request: parsed.data,
    ip,
    ua: request.headers.get('user-agent'),
  });

  // 后台触发；不 await；失败时 runner 自己写 fail 状态
  void runIntegrationJob(job.id).catch(() => {});

  void trackEvent('integration.mistake.create', {
    jobId: job.id,
    subject: job.subject,
    source: job.source,
    ip,
  }, { request });

  return apiSuccess(
    {
      jobId: job.id,
      status: 'queued' as const,
      statusUrl: `/api/integrations/jobs/${job.id}`,
    },
    201,
  );
}
