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

import { promises as fs } from 'fs';
import path from 'path';
import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import {
  combinedLevel,
  scoreClassroomsForLevel,
  type CspLevel,
  type PlacementAnswers,
} from './csp-placement';

export type LlmRecommendation = {
  level: CspLevel;
  /** id-only list, kept for backward compat with the placement API consumers. */
  recommendedIds: string[];
  /** id + title pairs, used by the UI to render the recommendation cards. */
  recommendedClassrooms: { id: string; title: string }[];
  aiReason: string;
  aiStatus: 'ok' | 'fallback';
};

// Soft timeout for the LLM call. 5s was too aggressive — observed
// `deepseek/deepseek-v4-flash` cold-start latency on the KIMI proxy
// sits at 8-12s, so a 5s ceiling always tripped the fallback even when
// the upstream was healthy. 30s is the wall-clock budget for the
// POST handler; if the model still hasn't replied by then the user's
// patience is gone regardless. Bumping to 30s and keeping the soft-
// timeout pattern (so we still return a deterministic recommendation
// on hard upstream failure).
const SOFT_TIMEOUT_MS = 30000;
const FALLBACK_REASON = '根据基础画像，暂未生成定制推荐。';
// Default model used when no client override is provided. Must be a
// fast, cheap model — placement is a low-stakes batch operation that
// runs synchronously in the request path.
//
// We re-use the project's shared DEFAULT_MODEL (the same env var the
// rest of the app uses, e.g. for mistake OCR). It is already wired up
// to a working provider via server-providers.yml / env vars, so the
// placement flow inherits whatever provider the operator has
// configured — typically kimi:moonshotai/kimi-k2.5 in this project.
//
// Earlier this hard-coded "minimax:MiniMax-Text-01" which is not a
// valid (provider, model) pair in the registry (minimax only ships
// "MiniMax-M2.7"), so every call fell through to the deterministic
// fallback. See commit history for the postmortem.
const DEFAULT_MODEL_STRING = process.env.PLACEMENT_MODEL || process.env.DEFAULT_MODEL || '';

/**
 * Read every classroom .json on disk and return its id + display
 * title. The recommender prompt is anchored against this list so the
 * model can only return ids the operator has actually uploaded, and
 * can reason about each candidate's actual content rather than
 * picking a random id off the list.
 *
 * Cached for the lifetime of the module. The classrooom list only
 * changes when the admin uploads/removes a classroom, which is rare
 * enough that re-reading on every placement call would be wasted I/O.
 *
 * Exported so the placement API route can decorate legacy
 * `recommendedIds` rows (written before titles were stored) with
 * their current on-disk title at read time — see route.ts.
 */
export type ClassroomMeta = { id: string; title: string };
let _availableMetaCache: { list: ClassroomMeta[]; byId: Map<string, string>; loadedAt: number } | null = null;
const AVAILABLE_IDS_TTL_MS = 30_000;

/**
 * Public re-export of the classroom-metadata loader. The implementation
 * lives in `_loadAvailableClassroomsImpl` so it can be referenced
 * from `recommendClassrooms` (which needs the same allowlist for the
 * prompt) without paying an extra cache lookup. The route handler in
 * `/api/csp-quiz/placement` imports this to decorate legacy
 * `recommendedIds` rows with their current on-disk title at read time.
 */
export async function loadAvailableClassrooms() {
  return _loadAvailableClassroomsImpl();
}

async function _loadAvailableClassroomsImpl(): Promise<{
  list: ClassroomMeta[];
  byId: Map<string, string>;
}> {
  const now = Date.now();
  if (_availableMetaCache && now - _availableMetaCache.loadedAt < AVAILABLE_IDS_TTL_MS) {
    return { list: _availableMetaCache.list, byId: _availableMetaCache.byId };
  }
  const list: ClassroomMeta[] = [];
  const byId = new Map<string, string>();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(CLASSROOMS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn(
        '[csp-placement] could not read CLASSROOMS_DIR',
        CLASSROOMS_DIR,
        err instanceof Error ? err.message : String(err),
      );
    }
    _availableMetaCache = { list, byId, loadedAt: now };
    return { list, byId };
  }
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    try {
      // Strip UTF-8 BOM if present — PowerShell's `ConvertTo-Json`
      // emits a BOM, and `JSON.parse` rejects it as a syntax error.
      const raw = (await fs.readFile(path.join(CLASSROOMS_DIR, name), 'utf-8')).replace(/^\ufeff/, '');
      const data = JSON.parse(raw) as {
        stage?: { name?: string; title?: string; description?: string };
        title?: string;
      };
      // The stage's `name` is what the public lecture page shows
      // (e.g. "0. CSP-J/S初赛题型一览" / "1. CSP初赛要点精讲" /
      // "3. CSP初赛要点精讲：计算机网络"). Fall back to top-level
      // title, then id, in that order. We deliberately don't pull
      // a description into the prompt — those are usually long
      // and bloat the token budget without helping the LLM pick
      // better.
      const title =
        data?.stage?.name ??
        data?.stage?.title ??
        data?.title ??
        id;
      list.push({ id, title });
      byId.set(id, title);
    } catch {
      // Skip unreadable / corrupt file; it's still in the
      // allowlist for ID purposes, just without a title in the
      // prompt.
      list.push({ id, title: id });
      byId.set(id, id);
    }
  }
  _availableMetaCache = { list, byId, loadedAt: now };
  return { list, byId };
}

/**
 * Filter `recommendedIds` to only include ids that exist on disk.
 * If the LLM's picklist is empty after filtering (or the model
 * hallucinated only unknown ids), fall back to the deterministic
 * `scoreClassroomsForLevel` so the banner is never empty.
 */
function filterToValidIds(
  recommendedIds: string[],
  byId: Map<string, string>,
  level: CspLevel,
  available: { id: string; title: string }[],
): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const id of recommendedIds) {
    if (byId.has(id)) out.push({ id, title: byId.get(id) ?? id });
  }
  if (out.length > 0) return out;
  return scoreClassroomsForLevel(level, available, 3);
}

function buildPrompt(
  answers: PlacementAnswers,
  available: ClassroomMeta[],
): string {
  const lines: string[] = [];
  lines.push(`你是一位 CSP 初赛辅导老师，根据学生信息给出 1 段简短点评（80-150 字）和最多 3 个推荐课件。`);
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
  // Inject the allowlist of real classroom ids + their titles so the
  // model can reason about content rather than guessing random ids.
  // The id is the stable handle the UI uses to build the link
  // (`/classroom/<id>`); the title is what the student actually
  // sees. Post-parse, we drop any recommendedId that isn't in this
  // set, so the model can't "cheat" by inventing a plausible id.
  if (available.length > 0) {
    lines.push(`# 真实存在的课件（必须从下面 id 列表里选择，最多 3 个，按适合度从高到低排序）`);
    for (const { id, title } of available) lines.push(`- id=${id}  |  标题：${title}`);
  } else {
    lines.push(`# 课件库为空，返回空数组即可`);
  }
  lines.push(``);
  lines.push(`# 输出格式（严格 JSON，不要 markdown 代码块）`);
  lines.push(`{`);
  lines.push(`  "level": "beginner" | "intermediate" | "advanced",`);
  lines.push(`  "recommendedIds": ["<课件 id，必须在上面的列表里>", ...],`);
  lines.push(`  "reason": "<80-150 字的点评，引用学生画像里的具体信号>"`);
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

function buildFallback(
  answers: PlacementAnswers,
  available: { id: string; title: string }[],
): LlmRecommendation {
  const level = combinedLevel(answers);
  const recommendations = scoreClassroomsForLevel(level, available, 3);
  return {
    level,
    recommendedIds: recommendations.map((r) => r.id),
    recommendedClassrooms: recommendations,
    aiReason: FALLBACK_REASON,
    aiStatus: 'fallback',
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
  // Resolve the on-disk classroom allowlist BEFORE we call the LLM so
  // we can (a) feed it (id, title) pairs into the prompt and (b) post-
  // validate the model's picks. We deliberately compute the level
  // from answers (deterministic) first so the fallback used by the
  // timeout / parse-fail path is the right one for this student.
  const { list: available, byId } = await _loadAvailableClassroomsImpl();
  const prompt = buildPrompt(answers, available);

  // Run the LLM call under a 30s soft timeout. If anything in
  // the chain throws (resolveModel, network, parse), we treat
  // it as "AI unavailable" and return the deterministic
  // fallback. This is a one-shot synchronous call from a
  // Next.js route handler, so the timeout is the user's
  // patience budget.
  const llmPromise = (async (): Promise<string> => {
    const resolved = await resolveModel({ modelString: DEFAULT_MODEL_STRING });
    const result = await callLLM(
      {
        model: resolved.model,
        messages: [
          {
            role: 'system',
            // Force a single-shot JSON response, no preamble, no thinking
            // out loud. The KIMI proxy fronting `deepseek/deepseek-v4-flash`
            // was returning `result.text === ''` because the model was
            // burning its `maxOutputTokens` budget on chain-of-thought and
            // never got to the actual JSON. Telling the model to "answer
            // immediately" + bumping the token cap is the cheapest way to
            // make sure the JSON is in the response.
            content:
              '你是一位专业的 CSP 初赛辅导老师。直接输出最终 JSON，' +
              '不要思考、不要解释、不要 markdown 代码块包裹。',
          },
          { role: 'user', content: prompt },
        ],
        // 2000 is comfortably above the 80-150 字点评 + 3 课件 id payload,
        // so the model can't be starved by thinking tokens alone.
        maxOutputTokens: 2000,
        // We explicitly do NOT pass `temperature: 0` here because the
        // upstream KIMI proxy's openai-compatible endpoint may not
        // forward it; we only need reasoning to fit in the token cap.
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
      // eslint-disable-next-line no-console
      console.warn('[csp-placement] LLM soft-timeout after', SOFT_TIMEOUT_MS, 'ms; using fallback');
      return buildFallback(answers, available);
    }
    const parsed = parseLlmResponse(content);
    if (!parsed) {
      // eslint-disable-next-line no-console
      console.warn(
        '[csp-placement] LLM response did not parse as JSON; using fallback. raw:',
        content.slice(0, 300),
      );
      return buildFallback(answers, available);
    }
    // Post-validate the model's picks against the on-disk allowlist.
    // Hallucinated ids (e.g. "j1-computer-basics") would 404 in the
    // classroom page; better to fall back to the level's deterministic
    // list than ship a broken link to a student.
    const validated = filterToValidIds(
      parsed.recommendedIds,
      byId,
      parsed.level,
      available,
    );
    return {
      level: parsed.level,
      recommendedIds: validated.map((v) => v.id),
      recommendedClassrooms: validated,
      aiReason: parsed.aiReason,
      aiStatus: 'ok',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[csp-placement] LLM call threw; using fallback. err:',
      err instanceof Error ? err.message : String(err),
    );
    return buildFallback(answers, available);
  }
}
