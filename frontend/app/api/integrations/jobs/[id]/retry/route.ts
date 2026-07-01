import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readIntegrationJob, updateIntegrationJob } from '@/lib/integrations/store';
import { runIntegrationJob } from '@/lib/integrations/runner';
import { checkRateLimit, getClientIp } from '@/lib/integrations/rate-limit';
import { RateLimitedError } from '@/lib/integrations/errors';
import { trackEvent } from '@/lib/usage/track';

const RETRY_LIMIT = Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(request.headers);

  try {
    checkRateLimit(`retry:${ip}`, RETRY_LIMIT, 60_000);
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

  if (job.status !== 'failed') {
    return apiError(
      'INVALID_REQUEST',
      409,
      `job is in '${job.status}' state, only 'failed' jobs can be retried`,
    );
  }

  const now = Date.now();
  const expiresAt = Date.parse(job.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt < now) {
    return apiError('INTERNAL_ERROR', 410, 'job expired');
  }

  const reset = updateIntegrationJob(params.id, {
    status: 'queued',
    stage: null,
    errorCode: null,
    errorMessage: null,
  });
  if (!reset) return apiError('INTERNAL_ERROR', 500, 'failed to reset job');

  void runIntegrationJob(params.id).catch(() => {});

  void trackEvent('integration.jobs.retry', {
    jobId: params.id,
    ip,
  }, { request });

  return apiSuccess({
    jobId: reset.id,
    status: reset.status,
    statusUrl: `/api/integrations/jobs/${reset.id}`,
  });
}
