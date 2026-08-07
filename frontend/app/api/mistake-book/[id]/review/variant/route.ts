import { NextResponse } from 'next/server';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { getVisitorId } from '@/lib/visitor/server';
import {
  VARIANT_PROMPT_SYSTEM,
  buildVariantPrompt,
} from '@/lib/mistake-book/review-prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const log = createLogger('MistakeBook.ReviewVariant');

/**
 * POST /api/mistake-book/[id]/review/variant
 *
 * 第 3 段: 让 AI 出 1 道"同型变式题" + 标准答案.
 *
 * 前置条件: 第 1 段 (错因) 和 第 2 段 (正解) 都已经完成.
 * 幂等: 已有变式题时, 除非 force=true, 否则直接返回.
 *
 * Body: { force?: boolean }
 *
 * 响应 item 上会带 variantQuestion / variantAnswer (reasoning 在 log 里).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json(
      { success: false, error: 'No visitor session' },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  let force = false;
  try {
    const body = (await req.json()) as { force?: unknown };
    force = body?.force === true;
  } catch {
    // no body
  }

  const existing = db.mistakeBook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    );
  }
  if (existing.visitorId !== visitorId) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }
  if (!existing.errorCauseCategory) {
    return NextResponse.json(
      {
        success: false,
        error: '请先完成第 1 段: 记录错因',
        code: 'cause_not_recorded',
      },
      { status: 409 },
    );
  }
  if (!existing.correctSolution) {
    return NextResponse.json(
      {
        success: false,
        error: '请先完成第 2 段: 生成 AI 正解',
        code: 'solution_not_ready',
      },
      { status: 409 },
    );
  }
  if (existing.variantQuestion && !force) {
    return NextResponse.json({ success: true, item: existing, cached: true });
  }

  const modelString =
    process.env.MISTAKE_CLASSROOM_MODEL ||
    process.env.DEFAULT_MODEL ||
    'kimi:moonshotai/Kimi-K2.5';

  const resolved = await resolveModel({ modelString });

  const systemPrompt = VARIANT_PROMPT_SYSTEM;
  const userPrompt = buildVariantPrompt({ item: existing });

  let rawText = '';
  try {
    const result = await callLLM(
      {
        model: resolved.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 800,
      },
      'mistake-book/variant',
      // 变式题需要解析 JSON, 重试时也要再次跑 validate (这里 validate
      // 实际上只是检测"非空", JSON 合法性在下面 parse 时再判断)
      { retries: 1, validate: (t) => t.trim().length > 0 },
      resolved.thinkingConfig,
    );
    rawText = result.text.trim();
  } catch (error) {
    log.error('[variant] LLM call failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 生成变式题失败, 请稍后重试',
        code: 'llm_error',
      },
      { status: 502 },
    );
  }

  const parsed = parseJsonResponse<{
    question?: unknown;
    answer?: unknown;
    reasoning?: unknown;
  }>(rawText);

  if (!parsed) {
    log.warn(`[variant] Failed to parse JSON: ${rawText.slice(0, 200)}`);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 返回格式异常, 请稍后重试',
        code: 'llm_bad_json',
      },
      { status: 502 },
    );
  }

  const question =
    typeof parsed.question === 'string' ? parsed.question.trim() : '';
  const answer =
    typeof parsed.answer === 'string' ? parsed.answer.trim() : '';

  if (!question || !answer) {
    log.warn(`[variant] Missing question/answer: ${rawText.slice(0, 200)}`);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 返回内容不完整, 请稍后重试',
        code: 'llm_incomplete',
      },
      { status: 502 },
    );
  }

  // 防止 AI 太长, 题目超过 500 字就截断 (不会影响答题)
  const questionSafe = question.length > 500 ? question.slice(0, 500) : question;
  const answerSafe = answer.length > 200 ? answer.slice(0, 200) : answer;

  const nowIso = new Date().toISOString();
  const updated = db.mistakeBook.update({
    where: { id },
    data: {
      variantQuestion: questionSafe,
      variantAnswer: answerSafe,
      // 用户在 force=true 重新出题时, 旧的作答/判分要清掉, 防止和
      // 旧题对不上. 否则 variantUserAnswer 仍指向旧题, 学生会困惑.
      variantUserAnswer: force ? null : existing.variantUserAnswer,
      variantResult: force ? null : existing.variantResult,
      variantAt: nowIso,
      // 同理, 如果 reviewedAt 已打, 重新出题要让 reviewedAt 失效,
      // 等学生再做一次再决定.
      reviewedAt: force ? null : existing.reviewedAt,
      updatedAt: nowIso,
    },
  });

  return NextResponse.json({ success: true, item: updated });
}
