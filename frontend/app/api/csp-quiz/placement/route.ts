import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import {
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
  type PlacementAnswers,
} from '@/lib/server/csp-placement';
import { recommendClassrooms, loadAvailableClassrooms } from '@/lib/server/csp-placement-llm';

// GET /api/csp-quiz/placement
// Returns the current user's CSP placement survey result, or null
// if they have not filled it in yet. Used by PlacementBanner to
// decide between the "未摸底" and "已摸底" UI states.
//
// POST /api/csp-quiz/placement
// Submit a placement survey response. The 5 base questions
// (grade, studyMonths, selfRating, goal, hoursPerWeek) are
// required; the contest blocks are all optional. The handler:
//   1. Validates the body
//   2. UPSERTs a row with `aiStatus='pending'` and the
//      deterministic fallback recommendations, so the banner
//      always has something to show even if the LLM call
//      stalls or fails.
//   3. Synchronously calls the LLM (5s soft timeout). On
//      success/timeout/error, the final aiStatus + recommendedIds
//      are written via updateAi.
//
// Why a two-step write (upsert + updateAi)?
//   The route returns the *final* recommendation to the client
//   in the POST response, so we want the row to reflect the
//   LLM verdict. But the LLM can be slow or down — by writing
//   the fallback first, the next GET will at least return a
//   consistent "completed" row instead of an empty 500.

const REQUIRED_FIELDS = [
  'grade',
  'studyMonths',
  'selfRating',
  'goal',
  'hoursPerWeek',
] as const;

// CSP 复赛奖项只有一等奖 / 二等奖 / 三等奖 三档，不再区分省奖和国奖。
// 这里要跟 lib/server/csp-placement.ts 的 PlacementAnswers.cspJ2/cspS2
// 字面量联合保持一致，否则前端表单提交"一等奖"会被这里 reject。
const VALID_RANKS = ['一等奖', '二等奖', '三等奖'] as const;
const VALID_GESP_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const STUDY_VALUES = ['lt3', '3-6', '6-12', '12-24', 'gt24'] as const;
const RATING_VALUES = ['low', 'mid', 'high'] as const;
const GOAL_VALUES = ['pass-j1', 'pass-j2', 'high-rank', 'try-best'] as const;
const HOURS_VALUES = ['lt2', '2-5', '5-10', 'gt10'] as const;

type ContestBlock = {
  year: number;
  score?: number;
  rank?: (typeof VALID_RANKS)[number];
  level?: (typeof VALID_GESP_LEVELS)[number];
  passed?: boolean;
};

function isOneOf<T extends readonly string[]>(value: unknown, list: T): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function normalizeContestBlock(
  raw: unknown,
  opts: { requireScore?: boolean; requireRank?: boolean; requireLevel?: boolean; requirePassed?: boolean },
): ContestBlock | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!isIntInRange(obj.year, 2000, 2100)) return null;
  const block: ContestBlock = { year: obj.year };
  if (opts.requireScore) {
    if (!isIntInRange(obj.score, 0, 100)) return null;
    block.score = obj.score;
  }
  if (opts.requireRank) {
    if (!isOneOf(obj.rank, VALID_RANKS)) return null;
    block.rank = obj.rank;
  }
  if (opts.requireLevel) {
    if (typeof obj.level !== 'number' || !(VALID_GESP_LEVELS as readonly number[]).includes(obj.level)) {
      return null;
    }
    block.level = obj.level as ContestBlock['level'];
    if (opts.requirePassed) {
      if (typeof obj.passed !== 'boolean') return null;
      block.passed = obj.passed;
    }
  }
  return block;
}

function buildPlacementAnswers(body: Record<string, unknown>): PlacementAnswers | null {
  if (!isOneOf(body.studyMonths, STUDY_VALUES)) return null;
  if (!isOneOf(body.selfRating, RATING_VALUES)) return null;
  if (!isOneOf(body.goal, GOAL_VALUES)) return null;
  if (!isOneOf(body.hoursPerWeek, HOURS_VALUES)) return null;

  const cspJ1 = normalizeContestBlock(body.cspJ1, { requireScore: true });
  if (body.cspJ1 != null && cspJ1 === null) return null;
  const cspS1 = normalizeContestBlock(body.cspS1, { requireScore: true });
  if (body.cspS1 != null && cspS1 === null) return null;
  const cspJ2 = normalizeContestBlock(body.cspJ2, { requireRank: true });
  if (body.cspJ2 != null && cspJ2 === null) return null;
  const cspS2 = normalizeContestBlock(body.cspS2, { requireRank: true });
  if (body.cspS2 != null && cspS2 === null) return null;
  const gesp = normalizeContestBlock(body.gesp, { requireLevel: true, requirePassed: true });
  if (body.gesp != null && gesp === null) return null;

  const province = typeof body.province === 'string' && body.province.trim()
    ? body.province.trim()
    : null;
  const otherContests = typeof body.otherContests === 'string' && body.otherContests.trim()
    ? body.otherContests.trim()
    : null;

  return {
    grade: String(body.grade).trim(),
    studyMonths: body.studyMonths,
    selfRating: body.selfRating,
    goal: body.goal,
    hoursPerWeek: body.hoursPerWeek,
    province,
    cspJ1: cspJ1 as PlacementAnswers['cspJ1'],
    cspS1: cspS1 as PlacementAnswers['cspS1'],
    cspJ2: cspJ2 as PlacementAnswers['cspJ2'],
    cspS2: cspS2 as PlacementAnswers['cspS2'],
    gesp: gesp as PlacementAnswers['gesp'],
    otherContests,
  };
}

function rowToResponse(row: Record<string, unknown>) {
  let recommendedIds: string[] = [];
  try {
    const raw = row.recommendedIds;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      recommendedIds = parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    /* leave empty */
  }
  return {
    userId: String(row.userId ?? ''),
    grade: String(row.grade ?? ''),
    studyMonths: String(row.studyMonths ?? ''),
    selfRating: String(row.selfRating ?? ''),
    goal: String(row.goal ?? ''),
    hoursPerWeek: String(row.hoursPerWeek ?? ''),
    province: row.province ?? null,
    cspJ1: row.cspJ1Year != null ? { year: row.cspJ1Year, score: row.cspJ1Score } : null,
    cspS1: row.cspS1Year != null ? { year: row.cspS1Year, score: row.cspS1Score } : null,
    cspJ2: row.cspJ2Year != null ? { year: row.cspJ2Year, rank: row.cspJ2Rank } : null,
    cspS2: row.cspS2Year != null ? { year: row.cspS2Year, rank: row.cspS2Rank } : null,
    gesp: row.gespYear != null
      ? {
          year: row.gespYear,
          level: row.gespLevel,
          passed: row.gespPassed === 1,
        }
      : null,
    otherContests: row.otherContests ?? null,
    level: String(row.level ?? ''),
    recommendedIds,
    aiReason: row.aiReason ?? '',
    aiStatus: String(row.aiStatus ?? 'fallback'),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const row = db.cspPlacement.findUnique(session.user.id);
  if (!row) return NextResponse.json({ placement: null });
  const base = rowToResponse(row);
  // 用磁盘上的 (id → title) 映射回填老数据里只有 id 没有 title 的字段。
  // 即使 LLM 后来清理掉了某个 id，title 会落回 id 字符串，至少不会 404。
  const { byId } = await loadAvailableClassrooms();
  const recommendedClassrooms = base.recommendedIds.map((id) => ({
    id,
    title: byId.get(id) ?? id,
  }));
  return NextResponse.json({ placement: { ...base, recommendedClassrooms } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  for (const field of REQUIRED_FIELDS) {
    if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
      return apiError(`基础 5 题缺一不可：缺少 ${field}`, 400);
    }
  }

  const answers = buildPlacementAnswers(body);
  if (!answers) {
    return apiError('摸底答案字段不合法（请检查单选/复赛/GESP 格式）', 400);
  }

  const now = new Date().toISOString();
  const level = combinedLevel(answers);
  const fallbackIds = FALLBACK_RECOMMENDATIONS[level];

  // 1) UPSERT with aiStatus='pending' and the deterministic
  //    fallback so the row is at least consistent. The LLM
  //    verdict will overwrite this via updateAi() below.
  db.cspPlacement.upsert({
    userId,
    grade: answers.grade,
    studyMonths: answers.studyMonths,
    selfRating: answers.selfRating,
    goal: answers.goal,
    hoursPerWeek: answers.hoursPerWeek,
    province: answers.province,
    cspJ1Year: answers.cspJ1?.year ?? null,
    cspJ1Score: answers.cspJ1?.score ?? null,
    cspS1Year: answers.cspS1?.year ?? null,
    cspS1Score: answers.cspS1?.score ?? null,
    cspJ2Year: answers.cspJ2?.year ?? null,
    cspJ2Rank: answers.cspJ2?.rank ?? null,
    cspS2Year: answers.cspS2?.year ?? null,
    cspS2Rank: answers.cspS2?.rank ?? null,
    gespYear: answers.gesp?.year ?? null,
    gespLevel: answers.gesp?.level ?? null,
    gespPassed: answers.gesp ? (answers.gesp.passed ? 1 : 0) : null,
    otherContests: answers.otherContests,
    level,
    recommendedIds: JSON.stringify(fallbackIds),
    aiReason: 'AI 分析中…',
    aiStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  // 2) Synchronously call LLM with 5s soft timeout (handled
  //    inside recommendClassrooms — it never throws, returns
  //    a fallback record on any error).
  const llmResult = await recommendClassrooms(answers);

  // 3) Update row with final LLM result. If LLM said ok AND
  //    returned at least 1 id, use those; otherwise keep the
  //    pre-written fallback list.
  const finalIds =
    llmResult.aiStatus === 'ok' && llmResult.recommendedIds.length > 0
      ? llmResult.recommendedIds
      : fallbackIds;
  db.cspPlacement.updateAi(
    userId,
    llmResult.aiReason,
    JSON.stringify(finalIds),
    llmResult.aiStatus,
    now,
  );

  // LLM 路径总会返回 recommendedClassrooms（buildFallback 也会走
  // scoreClassroomsForLevel 拿到 title）。如果出现空数组这种异常
  // 情况，再用磁盘映射兜底一次，绝不让前端只看到 id。
  let recommendedClassrooms = llmResult.recommendedClassrooms;
  if (recommendedClassrooms.length === 0) {
    const { byId } = await loadAvailableClassrooms();
    recommendedClassrooms = finalIds.map((id) => ({ id, title: byId.get(id) ?? id }));
  }

  return NextResponse.json({
    ok: true,
    level: llmResult.level,
    recommendedIds: finalIds,
    recommendedClassrooms,
    aiReason: llmResult.aiReason,
    aiStatus: llmResult.aiStatus,
  });
}
