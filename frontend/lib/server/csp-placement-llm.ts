/**
 * CSP Placement LLM Wrapper
 *
 * Synchronously call the configured LLM to get a personalised
 * recommendation for a CSP初赛 placement survey response. On any
 * failure (timeout, parse error, network error, missing fields),
 * fall back to a hard-coded classroom list driven by `combinedLevel`.
 *
 * Timeout strategy:
 *   - 5s soft timeout via `Promise.race` (the wrapper itself)
 *   - This file is called from an API route handler, so a synchronous
 *     return is required. The 5s cap keeps the POST /api/csp-quiz/placement
 *     round-trip under the user's patience threshold; longer waits
 *     degrade UX without adding value.
 *
 * Related spec: docs/superpowers/specs/2026-07-26-csp-placement-design.md §4 API.
 */

import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import {
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
  type CspLevel,
  type PlacementAnswers,
} from './csp-placement';

export type LlmRecommendation = {
  level: CspLevel;
  recommendedIds: string[];
  aiReason: string;
  aiStatus: 'ok' | 'fallback';
};

const SOFT_TIMEOUT_MS = 5000;
const FALLBACK_REASON = '根据基础画像，暂未生成定制推荐。';
// Default model used when no client override is provided. Must be a
// fast, cheap model — placement is a low-stakes batch operation that
// runs synchronously in the request path.
const DEFAULT_MODEL_STRING = process.env.PLACEMENT_MODEL || 'minimax:MiniMax-Text-01';

function buildPrompt(answers: PlacementAnswers): string {
  const lines: string[] = [];
  lines.push(`你是一位 CSP 初赛辅导老师，根据学生信息给出 1 段简短点评（80-150 字）和最多 3 个推荐课件 id。`);
  lines.push(``);
  lines.push(`# 学生信息`);
  lines.push(`- 年级：${answers.grade}`);
  lines.push(`- 学 C++ 时长：${answers.studyMonths}`);
  lines.push(`- 自评水平：${answers.selfRating}`);
  lines.push(`- 目标：${answers.goal}`);
  lines.push(`- 每周投入：${answers.hoursPerWeek}`);
  if (answers.province) lines.push(`- 省份：${answers.province}`);
  if (answers.cspJ1) lines.push(`- CSP-J1 ${answers.cspJ1.year}：${answers.cspJ1.score} 分`);
  if (answers.cspS1) lines.push(`- CSP-S1 ${answers.cspS1.year}：${answers.cspS1.score} 分`);
  if (answers.cspJ2) lines.push(`- CSP-J2 ${answers.cspJ2.year}：${answers.cspJ2.rank}`);
  if (answers.cspS2) lines.push(`- CSP-S2 ${answers.cspS2.year}：${answers.cspS2.rank}`);
  if (answers.gesp) {
    const passedText = answers.gesp.passed ? '已通过' : '未通过';
    lines.push(`- GESP ${answers.gesp.year}：${answers.gesp.level} 级 ${passedText}`);
  }
  if (answers.otherContests) lines.push(`- 其它奖项：${answers.otherContests}`);
  lines.push(``);
  lines.push(`# 输出格式（严格 JSON，不要 markdown 代码块）`);
  lines.push(`{`);
  lines.push(`  "level": "beginner" | "intermediate" | "advanced",`);
  lines.push(`  "recommendedIds": ["<课件id>", ...],`);
  lines.push(`  "reason": "<80-150 字的点评>"`);
  lines.push(`}`);
  return lines.join('\n');
}

function parseLlmResponse(
  content: string,
): { level: CspLevel; recommendedIds: string[]; aiReason: string } | null {
  // Strip markdown code fences if the model wraps the JSON anyway.
  const trimmed = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '');
  try {
    // The model occasionally returns prose around the JSON; try
    // the first {...} block if a direct parse fails.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) return null;
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    }
    const { level, recommendedIds, reason } = parsed;
    if (
      typeof level === 'string' &&
      (level === 'beginner' || level === 'intermediate' || level === 'advanced') &&
      Array.isArray(recommendedIds) &&
      typeof reason === 'string'
    ) {
      return {
        level,
        recommendedIds: recommendedIds
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(0, 3),
        aiReason: reason,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function buildFallback(answers: PlacementAnswers): {
  level: CspLevel;
  recommendedIds: string[];
  aiReason: string;
} {
  const level = combinedLevel(answers);
  return {
    level,
    recommendedIds: FALLBACK_RECOMMENDATIONS[level],
    aiReason: FALLBACK_REASON,
  };
}

/**
 * Call the configured LLM with a 5s soft timeout. On any
 * failure (timeout, parse error, network error, missing
 * fields), return a hard-coded fallback based on the
 * student's answers.
 *
 * The function never throws — the POST handler should be
 * able to commit a `fallback` row even when the LLM is
 * completely down.
 */
export async function recommendClassrooms(
  answers: PlacementAnswers,
): Promise<LlmRecommendation> {
  const prompt = buildPrompt(answers);

  // Run the LLM call under a 5s soft timeout. If anything in
  // the chain throws (resolveModel, network, parse), we treat
  // it as "AI unavailable" and return the deterministic
  // fallback. This is a one-shot synchronous call from a
  // Next.js route handler, so the timeout is the user's
  // patience budget.
  const llmPromise = (async () => {
    const resolved = await resolveModel({ modelString: DEFAULT_MODEL_STRING });
    const result = await callLLM(
      {
        model: resolved.model,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的 CSP 初赛辅导老师。',
          },
          { role: 'user', content: prompt },
        ],
        maxOutputTokens: 600,
      },
      'csp-placement-recommend',
    );
    return result.text ?? '';
  })();

  const timeout = new Promise<string>((resolve) =>
    setTimeout(() => resolve('__TIMEOUT__'), SOFT_TIMEOUT_MS),
  );

  try {
    const content = await Promise.race([llmPromise, timeout]);
    if (content === '__TIMEOUT__') {
      return { ...buildFallback(answers), aiStatus: 'fallback' };
    }
    const parsed = parseLlmResponse(content);
    if (!parsed) {
      return { ...buildFallback(answers), aiStatus: 'fallback' };
    }
    return { ...parsed, aiStatus: 'ok' };
  } catch {
    return { ...buildFallback(answers), aiStatus: 'fallback' };
  }
}
