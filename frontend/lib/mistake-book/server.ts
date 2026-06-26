import { db } from '@/lib/db';
import type { MistakeBookItem } from './api';

export interface MistakeBookListServerOptions {
  includeResolved?: boolean;
  limit?: number;
}

export interface MistakeBookListResponse {
  success: true;
  items: MistakeBookItem[];
  total: number;
  unresolved: number;
  pagination: { limit: number; hasMore: boolean };
}

/**
 * Server-side equivalent of `GET /api/mistake-book/list`. Used by
 * the `/mistake-book` page so we can prerender the first page
 * without an internal HTTP roundtrip.
 *
 * Returns the same shape the API does so the client list component
 * can take it as its `initial` prop and avoid a duplicate fetch on
 * first render.
 */
export function listMistakeBookServer(
  visitorId: string,
  options: MistakeBookListServerOptions = {},
): MistakeBookListResponse {
  const limit = Math.min(200, Math.max(1, options.limit ?? 100));
  const includeResolved = options.includeResolved ?? false;

  const where: Record<string, unknown> = { visitorId };
  if (!includeResolved) {
    where.isResolved = 0;
  }

  const items = db.mistakeBook.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const total = db.mistakeBook.count({ where: { visitorId } });
  const unresolved = db.mistakeBook.count({
    where: { visitorId, isResolved: 0 },
  });

  return {
    success: true,
    items: items as unknown as MistakeBookItem[],
    total,
    unresolved,
    pagination: { limit, hasMore: items.length === limit },
  };
}
