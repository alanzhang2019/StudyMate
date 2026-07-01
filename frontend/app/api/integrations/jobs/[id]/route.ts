import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { checkRateLimit, getClientIp } from '@/lib/integrations/rate-limit';
import { RateLimitedError } from '@/lib/integrations/errors';
import { readIntegrationJob } from '@/lib/integrations/store';
import { trackEvent } from '@/lib/usage/track';

const POLL_LIMIT = Number(process.env.RATE_LIMIT_INTEGRATION_POLL_PER_MIN ?? 120);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(request.headers);
  try {
    checkRateLimit(`poll:${ip}`, POLL_LIMIT, 60_000);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return NextResponse.json(
        { success: false, errorCode: 'RATE_LIMITED', error: err.message, retryAfter: err.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSec) } },
      );
    }
    throw err;
  }

  const job = readIntegrationJob(params.id);
  if (!job) return apiError('INTERNAL_ERROR', 404, 'job not found');

  const now = Date.now();
  const expiresAt = Date.parse(job.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt < now) {
    return apiError('INTERNAL_ERROR', 410, 'job expired');
  }

  const sessionId = job.sessionId;
  const generationUrl = sessionId
    ? `/generation-preview?session=${sessionId}&from=integration`
    : null;
  const classroomUrl = job.classroomId ? `/classroom/${job.classroomId}` : null;

  void trackEvent('integration.jobs.poll', {
    jobId: job.id, status: job.status, ip,
  }, { request });

  return apiSuccess({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    sessionId,
    generationUrl,
    classroomUrl,
    error: job.status === 'failed'
      ? { code: job.errorCode, message: job.errorMessage }
      : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
