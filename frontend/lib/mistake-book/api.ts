import { visitorFetch } from '@/lib/visitor/client';

/**
 * Mirror of the `mistake_book` SQL row exposed to the browser.
 *
 * The server returns camelCase (see `lib/db.ts` `rowToCamel`). Keep
 * this in sync if you add/remove columns.
 */
export interface MistakeBookItem {
  id: string;
  visitorId: string;
  imageUrl: string | null;
  problemText: string;
  userAnswer: string | null;
  correctAnswer: string | null;
  classroomId: string | null;
  sessionId: string | null;
  subject: string | null;
  grade: string | null;
  title: string | null;
  isResolved: 0 | 1;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MistakeBookListResponse {
  success: true;
  items: MistakeBookItem[];
  total: number;
  unresolved: number;
  pagination: { limit: number; hasMore: boolean };
}

export interface MistakeBookAddInput {
  /**
   * Required unless `mistakeSessionId` is provided — the server
   * will then hydrate the problem text from the persisted session.
   */
  problemText?: string;
  title?: string;
  imageUrl?: string;
  userAnswer?: string;
  correctAnswer?: string;
  classroomId?: string;
  sessionId?: string;
  subject?: string;
  grade?: string;
  /**
   * When the caller only has a mistakeSessionId (e.g. the floating
   * "加入错题本" button on the classroom page), the server will
   * hydrate problemText / userAnswer / correctAnswer / imageUrl /
   * classroomId from the persisted MistakeSession. If you have
   * problemText in hand, prefer passing it directly — the
   * mistakeSessionId path is only a fallback.
   */
  mistakeSessionId?: string;
}

export interface MistakeBookAddResponse {
  success: true;
  item: MistakeBookItem;
  deduplicated?: boolean;
}

export class MistakeBookApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'MistakeBookApiError';
  }
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    const msg = body?.error ?? body?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  } catch {
    // not JSON — fall through
  }
  return fallback;
}

export async function addMistakeBook(
  input: MistakeBookAddInput,
): Promise<MistakeBookAddResponse> {
  const res = await visitorFetch('/api/mistake-book/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '加入错题本失败'),
      res.status,
    );
  }
  return (await res.json()) as MistakeBookAddResponse;
}

export async function listMistakeBook(options?: {
  includeResolved?: boolean;
  limit?: number;
}): Promise<MistakeBookListResponse> {
  const params = new URLSearchParams();
  if (options?.includeResolved) params.set('includeResolved', 'true');
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const url = `/api/mistake-book/list${qs ? `?${qs}` : ''}`;
  const res = await visitorFetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '获取错题本失败'),
      res.status,
    );
  }
  return (await res.json()) as MistakeBookListResponse;
}

export async function toggleResolvedMistakeBook(
  id: string,
): Promise<{ success: true; item: MistakeBookItem }> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}/toggle-resolved`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '更新状态失败'),
      res.status,
    );
  }
  return (await res.json()) as { success: true; item: MistakeBookItem };
}

export async function deleteMistakeBook(id: string): Promise<{ success: true }> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '删除失败'),
      res.status,
    );
  }
  return (await res.json()) as { success: true };
}
