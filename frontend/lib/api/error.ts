import { NextResponse } from 'next/server';

/**
 * Lightweight error helper used by the csp-progress / csp-quiz
 * route handlers. We keep it separate from
 * `@/lib/server/api-response` (which uses the structured
 * `errorCode` envelope) because the progress endpoints are
 * client-telemetry APIs and the simpler `(message, status)`
 * signature is enough. The teacher dashboard reads them via
 * `response.ok` + a parse fallback, so the lack of an
 * errorCode field on these endpoints is not user-visible.
 */
export function apiError(
  message: string,
  status: number,
  details?: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}
