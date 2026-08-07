import { NextResponse } from 'next/server';

import { callLLM } from '@/lib/ai/llm';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { getVisitorId } from '@/lib/visitor/server';
import {
  SOLUTION_PROMPT_SYSTEM,
  buildSolutionPrompt,
} from '@/lib/mistake-book/review-prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const log = createLogger('MistakeBook.ReviewSolution');

/**
 * POST /api/mistake-book/[id]/review/solution
 *
 * 第 2 段: 让 AI 出一道"错题正解" (标准解题思路, 不是单纯答案).
 *
 * 前置条件: 第 1 段已经做完 (errorCauseCategory 已设置).
 * 幂等: 已经生成过正解时, 除非显式 force=true, 否则直接返回现有正解.
 *
 * Body: { force?: boolean }
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

  // force 是可选的 — 让用户能"再生成一次"
  let force = false;
  try {
    const body = (await req.json()) as { force?: unknown };
    force = body?.force === true;
  } catch {
    // body 是可选的, 没传就走默认
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
  if (existing.correctSolution && !force) {
    return NextResponse.json({ success: true, item: existing, cached: true });
  }

  // 选模型: 优先用 MISTAKE_CLASSROOM_MODEL (kimi:moonshotai/kimi-k2.5),
  // 这是生成讲题文本的主模型, 已经验证能稳定输出中文数学解释.
  // 退到 DEFAULT_MODEL, 再退到 kimi-k2.5.
  const modelString =
    process.env.MISTAKE_CLASSROOM_MODEL ||
    process.env.DEFAULT_MODEL ||
    'kimi:moonshotai/Kimi-K2.5';

  const resolved = await resolveModel({ modelString });

  const systemPrompt = SOLUTION_PROMPT_SYSTEM;
  const userPrompt = buildSolutionPrompt({
    item: existing,
    errorCause: existing.errorCause,
    errorCauseCategory: existing.errorCauseCategory,
  });

  let solutionText = '';
  try {
    const result = await callLLM(
      {
        model: resolved.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 1500,
      },
      'mistake-book/solution',
      // 重试 1 次: 答案文本为空时再试一次 (有的模型第一发会"思考后没写完")
      {
        retries: 1,
        validate: (t) => t.trim().length >= 50,
      },
      resolved.thinkingConfig,
    );
    solutionText = result.text.trim();
  } catch (error) {
    log.error('[solution] LLM call failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 生成正解失败, 请稍后重试',
        code: 'llm_error',
      },
      { status: 502 },
    );
  }

  // 保险: 即便 prompt 说纯 Markdown, 部分模型仍会包 ```json ... ```,
  // 解开外层 code fence 即可.
  solutionText = stripCodeFence(solutionText);

  if (solutionText.length < 30) {
    return NextResponse.json(
      {
        success: false,
        error: 'AI 生成的正文太短, 请稍后重试',
        code: 'llm_too_short',
      },
      { status: 502 },
    );
  }

  const nowIso = new Date().toISOString();
  const updated = db.mistakeBook.update({
    where: { id },
    data: {
      correctSolution: solutionText,
      correctSolutionAt: nowIso,
      updatedAt: nowIso,
    },
  });

  return NextResponse.json({ success: true, item: updated });
}

function stripCodeFence(text: string): string {
  // 兼容 "```markdown\n...\n```" / "```\n...\n```" / ```json
  return text
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}
