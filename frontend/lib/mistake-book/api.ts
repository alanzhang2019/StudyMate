import { visitorFetch } from '@/lib/visitor/client';

/**
 * Mirror of the `mistake_book` SQL row exposed to the browser.
 *
 * The server returns camelCase (see `lib/db.ts` `rowToCamel`). Keep
 * this in sync if you add/remove columns.
 *
 * 2026-07-02 错题三段复盘改造: 增加了 10 个复盘相关列
 * (errorCause, errorCauseCategory, correctSolution, correctSolutionAt,
 *  variantQuestion, variantAnswer, variantUserAnswer, variantResult,
 *  variantAt, reviewedAt). 老库这些列是 NULL, 客户端要兼容.
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
  // --- 三段复盘 (2026-07-02) ---
  /** 第 1 段: 用户对错因的自由描述. */
  errorCause: string | null;
  /** 第 1 段: 错因分类 ('careless' | 'wrong_approach' | 'missing_knowledge' | 'other'). */
  errorCauseCategory: string | null;
  /** 第 2 段: AI 生成的标准解题思路. */
  correctSolution: string | null;
  /** 第 2 段: 正解生成时间 (ISO). */
  correctSolutionAt: string | null;
  /** 第 3 段: AI 出的同类变式题题目. */
  variantQuestion: string | null;
  /** 第 3 段: 变式题标准答案 (用于服务端比对 + 给 AI 判分用). */
  variantAnswer: string | null;
  /** 第 3 段: 用户提交的答案. */
  variantUserAnswer: string | null;
  /**
   * 第 3 段: 变式题判分结果.
   * 0 = 错, 1 = 对, null = 未判分 (用户提交了答案但 AI 还没回, 或还没提交).
   */
  variantResult: 0 | 1 | null;
  /** 第 3 段: 变式题生成时间. */
  variantAt: string | null;
  /** 三段全部完成且变式题答对时打这个时间戳. */
  reviewedAt: string | null;
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

// ---------------------------------------------------------------------------
// 三段复盘 API 客户端 (2026-07-02 改造)
// ---------------------------------------------------------------------------

export type ReviewErrorCausePayload = {
  cause: string;
  category: string;
};

export type ReviewVariantSubmitPayload = {
  userAnswer: string;
};

/** 第 1 段: 保存错因. */
export async function saveReviewCause(
  id: string,
  payload: ReviewErrorCausePayload,
): Promise<{ success: true; item: MistakeBookItem }> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}/review/cause`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '保存错因失败'),
      res.status,
    );
  }
  return (await res.json()) as { success: true; item: MistakeBookItem };
}

/** 第 2 段: 生成 AI 正解. force=true 表示重新生成 (覆盖旧的). */
export async function generateReviewSolution(
  id: string,
  options?: { force?: boolean },
): Promise<{ success: true; item: MistakeBookItem; cached?: boolean }> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}/review/solution`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: options?.force === true }),
    },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '生成正解失败'),
      res.status,
    );
  }
  return (await res.json()) as {
    success: true;
    item: MistakeBookItem;
    cached?: boolean;
  };
}

/** 第 3 段: 生成 AI 变式题. force=true 表示重新出题. */
export async function generateReviewVariant(
  id: string,
  options?: { force?: boolean },
): Promise<{ success: true; item: MistakeBookItem; cached?: boolean }> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}/review/variant`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: options?.force === true }),
    },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '生成变式题失败'),
      res.status,
    );
  }
  return (await res.json()) as {
    success: true;
    item: MistakeBookItem;
    cached?: boolean;
  };
}

/** 第 3 段: 提交变式题答案, 服务端 AI 判分. */
export async function submitReviewVariant(
  id: string,
  payload: ReviewVariantSubmitPayload,
): Promise<{
  success: true;
  item: MistakeBookItem;
  feedback: string;
  correct: boolean;
}> {
  const res = await visitorFetch(
    `/api/mistake-book/${encodeURIComponent(id)}/review/variant/submit`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new MistakeBookApiError(
      await parseError(res, '提交变式答案失败'),
      res.status,
    );
  }
  return (await res.json()) as {
    success: true;
    item: MistakeBookItem;
    feedback: string;
    correct: boolean;
  };
}
