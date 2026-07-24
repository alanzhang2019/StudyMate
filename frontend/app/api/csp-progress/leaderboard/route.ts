// GET /api/csp-progress/leaderboard
//
// Public leaderboard for the /csp-lecture page. NO auth required:
// the response is already name-masked (see
// lib/server/leaderboard.ts#maskName) so we don't gate visibility.
//
// The shape is consumed by the <Leaderboard /> client component
// mounted at the bottom of /csp-lecture.
//
// Caching: the server-side aggregation in
// lib/server/leaderboard.ts is in-process cached for 5 minutes
// (configurable via LEADERBOARD_TTL_MS). The HTTP response
// itself is also marked `Cache-Control: public, max-age=60` so
// browsers / CDNs can short-circuit repeat hits. We do NOT
// set a longer browser TTL because students are sensitive to
// "did my score just go up?" — a minute is the right balance
// between freshness and load.

import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/server/leaderboard';
import { apiError } from '@/lib/api/error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getLeaderboard();
    return NextResponse.json(snapshot, {
      headers: {
        // Public + 60s browser cache. The 5min server cache
        // behind this is a separate concern; this just stops
        // a /refresh storm from hammering Next.js.
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('[csp-progress/leaderboard] failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'failed to load leaderboard',
      err instanceof Error ? err.message : String(err),
    );
  }
}
