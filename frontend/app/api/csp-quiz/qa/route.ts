// POST /api/csp-quiz/qa
//
// 单错题 AI 答疑入口。
//
// Body: {
//   classroomId: string,
//   questionId: string,
//   userQuestion: string,
//   history?: Array<{ role: 'user' | 'assistant', content: string }>,
// }
// Auth: required.
//
// 内部调用 lib/server/csp-paper-qa.answerWrongQuestion，喂给 LLM
// 的内容是：错题的完整题干/选项/正确答案/学生答案/解析 + 学生
// 当前的提问 + 之前对话历史 (最多 8 轮)。同一组输入 5 分钟内复用。
//
// 错误码：
//   401 NOT_SIGNED_IN         未登录
//   400 MISSING_FIELD          classroomId / questionId / userQuestion 缺失
//   404 NOT_FOUND              classroomId 不在 24 套真题白名单
//   422 NOT_WRONG_ANSWER       该题不是错题 (不能答疑)
//   502 AI_FAILED              LLM 调用失败
//   500 INTERNAL_ERROR         其他

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/api/error';
import {
  answerWrongQuestion,
  PaperQaError,
  type QaHistoryItem,
  type QaRequest,
} from '@/lib/server/csp-paper-qa';
import { createLogger } from '@/lib/logger';

const log = createLogger('PaperQaAPI');

// 答疑一次通常 5-15 秒, 但允许长一些 (含思考时间); 60s 上限。
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: Partial<QaRequest>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, questionId, userQuestion, history } = body;
  if (!classroomId || typeof classroomId !== 'string') {
    return apiError('classroomId is required', 400);
  }
  if (!questionId || typeof questionId !== 'string') {
    return apiError('questionId is required', 400);
  }
  if (!userQuestion || typeof userQuestion !== 'string') {
    return apiError('userQuestion is required', 400);
  }

  // 限制 history 形状, 防止前端注入垃圾数据撑爆 prompt
  let safeHistory: QaHistoryItem[] | undefined;
  if (Array.isArray(history)) {
    safeHistory = history
      .filter(
        (h): h is QaHistoryItem =>
          !!h &&
          (h.role === 'user' || h.role === 'assistant') &&
          typeof h.content === 'string',
      )
      .slice(-8);
    if (safeHistory.length === 0) safeHistory = undefined;
  }

  try {
    const { answer, cached } = await answerWrongQuestion(
      userId,
      { classroomId, questionId, userQuestion, history: safeHistory },
      req,
    );
    return NextResponse.json({ success: true, answer, cached });
  } catch (err) {
    if (err instanceof PaperQaError) {
      log.warn(`[qa] ${err.code}: ${err.message}`);
      const statusByCode: Record<typeof err.code, number> = {
        NOT_FOUND: 404,
        NOT_WRONG_ANSWER: 422,
        NO_DATA: 422,
        AI_FAILED: 502,
      };
      return apiError(err.message, statusByCode[err.code]);
    }
    log.error('[qa] unexpected error:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      err instanceof Error ? err.message : String(err),
    );
  }
}
