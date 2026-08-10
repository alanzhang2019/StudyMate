// POST /api/csp-quiz/analyze-paper
//
// 单套历年真题的 AI 学习诊断报告。
//
// Body: { classroomId: string, forceRefresh?: boolean }
// Auth: required.
//
// 内部调用 lib/server/csp-paper-analysis.generatePaperAnalysis，
// 把当前用户对这套卷子所有场景的"最新一次提交"（latest-wins，
// 与 finalize-classroom 一致）抽成错题列表，喂给 LLM 出具结构
// 化 JSON 报告（薄弱知识点 / 根因 / 下一步建议）。
//
// 错误码：
//   401 NOT_SIGNED_IN       未登录
//   400 MISSING_FIELD        缺 classroomId
//   404 NOT_FOUND            classroomId 不在 24 套真题白名单
//                            或 classroom JSON 读不到
//   422 NO_WRONG_ANSWERS    本卷子没有错题（满分的卷子无需分析）
//   502 AI_FAILED            上游 LLM 调用失败
//   502 AI_PARSE_FAILED      LLM 返回非 JSON 或缺字段
//   500 INTERNAL_ERROR       其他
//
// 同一组错题 (user, classroom, sorted questionIds) 5 分钟内复用
// 上一次结果（in-process LRU 缓存），减少 token 消耗和延迟。

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/api/error';
import {
  generatePaperAnalysis,
  PaperAnalysisError,
} from '@/lib/server/csp-paper-analysis';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnalyzePaperAPI');

// Allow up to 60s for the LLM call. The route is hit
// synchronously after 交卷 so the student is waiting; 60s is the
// sweet spot between "AI has time to think" and "user gives up".
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: { classroomId?: string; forceRefresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, forceRefresh } = body;
  if (!classroomId || typeof classroomId !== 'string') {
    return apiError('classroomId is required', 400);
  }

  try {
    const report = await generatePaperAnalysis(userId, classroomId, req, {
      forceRefresh: !!forceRefresh,
    });
    return NextResponse.json({ success: true, report });
  } catch (err) {
    if (err instanceof PaperAnalysisError) {
      log.warn(`[analyze-paper] ${err.code}: ${err.message}`);
      const statusByCode: Record<typeof err.code, number> = {
        NOT_FOUND: 404,
        NO_DATA: 422,
        AI_FAILED: 502,
        AI_PARSE_FAILED: 502,
      };
      return apiError(err.message, statusByCode[err.code]);
    }
    log.error('[analyze-paper] unexpected error:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      err instanceof Error ? err.message : String(err),
    );
  }
}
