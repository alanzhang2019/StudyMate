import { apiSuccess } from '@/lib/server/api-response';

export const dynamic = 'force-dynamic';

const VERSION = '2026-07-02';

export async function GET() {
  return apiSuccess({
    status: 'ok',
    version: VERSION,
    subjects: ['cpp'],
    verdicts: ['AC', 'WA', 'TLE', 'RE', 'CE', 'MLE', 'PE'],
    rateLimits: {
      createPerMin: Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10),
      pollPerMin: Number(process.env.RATE_LIMIT_INTEGRATION_POLL_PER_MIN ?? 120),
      retryPerMin: Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10),
    },
    endpoints: {
      submit: 'POST /api/integrations/mistake',
      poll: 'GET /api/integrations/jobs/{jobId}',
      retry: 'POST /api/integrations/jobs/{jobId}/retry',
      health: 'GET /api/integrations/health',
    },
  });
}
