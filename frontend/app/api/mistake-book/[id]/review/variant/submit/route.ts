import { NextResponse } from 'next/server';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { getVisitorId } from '@/lib/visitor/server';
import {
  VARIANT_CHECK_PROMPT_SYSTEM,
  buildVariantCheckPrompt,
} from '@/lib/mistake-book/review-prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const log = createLogger('MistakeBook.ReviewVariantSubmit');

/**
 * POST /api/mistake-book/[id]/review/variant/submit
 *
 * 第 3 段: 学生提交变式题答案, 服务端调 LLM 判分.
 *
 * 前置条件: variantQuestion / variantAnswer 已经存在.
 * 答对 (variantResult=1) 时, 顺带把 reviewedAt 打上时间戳 —
 * 这是三段复盘完成的"强信号", 前端可以据此点亮"已掌握"标签.
 *
 * Body: { userAnswer: string }
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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const userAnswer =
    typeof body.userAnswer === 'string' ? body.userAnswer.trim() : '';
  if (!userAnswer) {
    return NextResponse.json(
      { success: false, error: 'userAnswer is required' },
      { status: 400 },
    );
  }
  if (userAnswer.length > 500) {
    return NextResponse.json(
      { success: false, error: 'answer too long (max 500 chars)' },
      { status: 400 },
    );
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
  if (!existing.variantQuestion || !existing.variantAnswer) {
    return NextResponse.json(
      {
        success: false,
        error: '请先生成变式题',
        code: 'variant_not_ready',
      },
      { status: 409 },
    );
  }

  const modelString =
    process.env.MISTAKE_CLASSROOM_MODEL ||
    process.env.DEFAULT_MODEL ||
    'kimi:moonshotai/Kimi-K2.5';

  const resolved = await resolveModel({ modelString });

  const systemPrompt = VARIANT_CHECK_PROMPT_SYSTEM;
  const userPrompt = buildVariantCheckPrompt({
    question: existing.variantQuestion,
    correctAnswer: existing.variantAnswer,
    userAnswer,
  });

  let parsed: {
    correct?: unknown;
    feedback?: unknown;
  } | null = null;
  try {
    const result = await callLLM(
      {
        model: resolved.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 400,
      },
      'mistake-book/variant-submit',
      { retries: 1, validate: (t) => t.trim().length > 0 },
      resolved.thinkingConfig,
    );
    parsed = parseJsonResponse<{ correct?: unknown; feedback?: unknown }>(
      result.text,
    );
  } catch (error) {
    log.error('[variant-submit] LLM call failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 判分失败, 请稍后重试',
        code: 'llm_error',
      },
      { status: 502 },
    );
  }

  if (!parsed) {
    log.warn('[variant-submit] Failed to parse grading JSON');
    return NextResponse.json(
      {
        success: false,
        error: 'AI 判分返回格式异常, 请稍后重试',
        code: 'llm_bad_json',
      },
      { status: 502 },
    );
  }

  // 判分 — `correct` 接受 boolean / "true" / "1" / 1
  const isCorrect = (() => {
    const c = parsed.correct;
    if (typeof c === 'boolean') return c;
    if (typeof c === 'number') return c === 1;
    if (typeof c === 'string') {
      const s = c.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === '正确' || s === '对';
    }
    return false;
  })();

  const feedback =
    typeof parsed.feedback === 'string' && parsed.feedback.trim().length > 0
      ? parsed.feedback.trim().slice(0, 300)
      : isCorrect
        ? '答对了, 这道题的解法你已经掌握了。'
        : '答案和标准答案不一致, 建议再看一下第 2 段的正解。';

  const nowIso = new Date().toISOString();
  const updated = db.mistakeBook.update({
    where: { id },
    data: {
      variantUserAnswer: userAnswer,
      variantResult: isCorrect ? 1 : 0,
      variantAt: nowIso,
      // 答对 → reviewedAt 戳上; 答错 → reviewedAt 维持原状 (即不置)
      reviewedAt: isCorrect ? nowIso : null,
      updatedAt: nowIso,
    },
  });

  return NextResponse.json({
    success: true,
    item: updated,
    feedback,
    correct: isCorrect,
  });
}
