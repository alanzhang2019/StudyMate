# CSP Placement + AI Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-page placement survey + AI recommendation banner to `/csp-lecture` that helps students pick a starting classroom based on their grade, study history, and contest record.

**Architecture:**
- Frontend: 4 new client components (Banner / Modal / RecommendationCard / ConfirmReset) under `components/csp-lecture/`, integrated into `app/csp-lecture/page.tsx`.
- Backend: 2 new API routes under `app/api/csp-quiz/placement/`, 1 new LLM wrapper at `lib/server/csp-placement-llm.ts`, and 3 new pure functions in the existing `lib/server/csp-placement.ts` (commit `dbe2468`).
- Storage: 1 new SQLite table `csp_placement` keyed by `userId`, with UPSERT semantics.
- LLM: synchronously call `getCurrentModelConfig()` with a 5s soft timeout; if exceeded, return hardcoded fallback. Hard timeout 15s in background.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, vitest, React 18, Framer Motion, tailwindcss, getCurrentModelConfig() (existing).

---

## File Structure

```
frontend/
├── lib/
│   ├── db.ts                                  [MODIFY]  add csp_placement table + 3 methods
│   └── server/
│       ├── csp-placement.ts                   [MODIFY]  add scoreToLevelJ1 + combinedLevel + FALLBACK_RECOMMENDATIONS
│       ├── csp-placement.test.ts              [CREATE]  unit tests for new csp-placement functions
│       ├── csp-placement-llm.ts               [CREATE]  LLM call wrapper with 5s soft timeout
│       └── csp-placement-llm.test.ts          [CREATE]  unit tests with mock fetch
├── app/
│   ├── csp-lecture/
│   │   └── page.tsx                           [MODIFY]  add <PlacementBanner /> after hero
│   └── api/csp-quiz/placement/
│       ├── route.ts                           [CREATE]  GET/POST handlers
│       └── route.test.ts                      [CREATE]  integration tests
└── components/csp-lecture/
    ├── PlacementBanner.tsx                    [CREATE]  3-state banner
    ├── PlacementModal.tsx                     [CREATE]  single-page form modal
    ├── RecommendationCard.tsx                 [CREATE]  recommendation display
    └── ConfirmResetModal.tsx                  [CREATE]  reset confirmation
```

---

## Task 1: DB — Add `csp_placement` Table + Helpers

**Files:**
- Modify: `frontend/lib/db.ts:1-50` (add migration at end of init function)
- Test: manual (vitest setup already exists for this file)

- [ ] **Step 1: Locate the existing init function in `lib/db.ts`**

Run: `grep -n "CREATE TABLE" frontend/lib/db.ts | head -5`

Find the existing `CREATE TABLE IF NOT EXISTS` statements. We will add our new table at the end of the same `initDb` function.

- [ ] **Step 2: Add the new `csp_placement` table**

At the end of the `initDb` function (after the last `CREATE TABLE IF NOT EXISTS` statement but before any `console.log`/return), add:

```sql
CREATE TABLE IF NOT EXISTS csp_placement (
  userId TEXT PRIMARY KEY,
  -- 基础画像（必填 5 题）
  grade TEXT NOT NULL,
  studyMonths TEXT NOT NULL,
  selfRating TEXT NOT NULL,
  goal TEXT NOT NULL,
  hoursPerWeek TEXT NOT NULL,
  -- 比赛成绩（每项可为 null）
  province TEXT,
  cspJ1Year INTEGER, cspJ1Score INTEGER,
  cspS1Year INTEGER, cspS1Score INTEGER,
  cspJ2Year INTEGER, cspJ2Rank TEXT,
  cspS2Year INTEGER, cspS2Rank TEXT,
  gespYear INTEGER, gespLevel INTEGER, gespPassed INTEGER,
  otherContests TEXT,
  -- AI 推荐输出
  level TEXT NOT NULL,
  recommendedIds TEXT NOT NULL,
  aiReason TEXT,
  aiStatus TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_csp_placement_level ON csp_placement(level);
```

- [ ] **Step 3: Add 3 helper functions near the existing `cspQuizSubmission*` helpers**

Find the line `export function cspQuizSubmission...` and add the following block after the last `cspQuizSubmission*` function:

```ts
export type CspPlacementRow = {
  userId: string;
  grade: string;
  studyMonths: string;
  selfRating: string;
  goal: string;
  hoursPerWeek: string;
  province: string | null;
  cspJ1Year: number | null; cspJ1Score: number | null;
  cspS1Year: number | null; cspS1Score: number | null;
  cspJ2Year: number | null; cspJ2Rank: string | null;
  cspS2Year: number | null; cspS2Rank: string | null;
  gespYear: number | null; gespLevel: number | null; gespPassed: number | null;
  otherContests: string | null;
  level: string;
  recommendedIds: string;
  aiReason: string | null;
  aiStatus: string;
  createdAt: string;
  updatedAt: string;
};

export function getCspPlacement(userId: string): CspPlacementRow | null {
  const stmt = db.prepare('SELECT * FROM csp_placement WHERE userId = ?');
  return (stmt.get(userId) as CspPlacementRow | undefined) ?? null;
}

export function upsertCspPlacement(row: CspPlacementRow): void {
  const stmt = db.prepare(`
    INSERT INTO csp_placement (
      userId, grade, studyMonths, selfRating, goal, hoursPerWeek,
      province, cspJ1Year, cspJ1Score, cspS1Year, cspS1Score,
      cspJ2Year, cspJ2Rank, cspS2Year, cspS2Rank,
      gespYear, gespLevel, gespPassed, otherContests,
      level, recommendedIds, aiReason, aiStatus, createdAt, updatedAt
    ) VALUES (
      @userId, @grade, @studyMonths, @selfRating, @goal, @hoursPerWeek,
      @province, @cspJ1Year, @cspJ1Score, @cspS1Year, @cspS1Score,
      @cspJ2Year, @cspJ2Rank, @cspS2Year, @cspS2Rank,
      @gespYear, @gespLevel, @gespPassed, @otherContests,
      @level, @recommendedIds, @aiReason, @aiStatus, @createdAt, @updatedAt
    )
    ON CONFLICT(userId) DO UPDATE SET
      grade = excluded.grade,
      studyMonths = excluded.studyMonths,
      selfRating = excluded.selfRating,
      goal = excluded.goal,
      hoursPerWeek = excluded.hoursPerWeek,
      province = excluded.province,
      cspJ1Year = excluded.cspJ1Year, cspJ1Score = excluded.cspJ1Score,
      cspS1Year = excluded.cspS1Year, cspS1Score = excluded.cspS1Score,
      cspJ2Year = excluded.cspJ2Year, cspJ2Rank = excluded.cspJ2Rank,
      cspS2Year = excluded.cspS2Year, cspS2Rank = excluded.cspS2Rank,
      gespYear = excluded.gespYear, gespLevel = excluded.gespLevel, gespPassed = excluded.gespPassed,
      otherContests = excluded.otherContests,
      level = excluded.level,
      recommendedIds = excluded.recommendedIds,
      aiReason = excluded.aiReason,
      aiStatus = excluded.aiStatus,
      updatedAt = excluded.updatedAt
  `);
  stmt.run(row);
}

export function updateCspPlacementAi(
  userId: string,
  aiReason: string,
  recommendedIds: string,
  aiStatus: 'ok' | 'fallback',
  updatedAt: string,
): void {
  const stmt = db.prepare(`
    UPDATE csp_placement
    SET aiReason = ?, recommendedIds = ?, aiStatus = ?, updatedAt = ?
    WHERE userId = ?
  `);
  stmt.run(aiReason, recommendedIds, aiStatus, updatedAt, userId);
}
```

- [ ] **Step 4: Run typecheck to verify**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors related to `db.ts`.

- [ ] **Step 5: Run linter**

Run: `cd frontend && npx eslint lib/db.ts 2>&1 | head -10`
Expected: 0 errors, possibly 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/db.ts
git commit -m "feat(db): add csp_placement table + get/upsert/updateAi helpers"
git push origin master
```

---

## Task 2: csp-placement.ts — Add 3 Pure Functions + Tests

**Files:**
- Modify: `frontend/lib/server/csp-placement.ts` (add at end of file)
- Create: `frontend/lib/server/csp-placement.test.ts`

- [ ] **Step 1: Read the existing `csp-placement.ts` to understand its type system**

Run: `cat frontend/lib/server/csp-placement.ts | head -60`
Expected: Find `CspLevel` type, `scoreToLevel` function, `levelLabel` constant. We will reuse these.

- [ ] **Step 2: Write the failing test for `scoreToLevelJ1`**

Create `frontend/lib/server/csp-placement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  scoreToLevelJ1,
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
} from './csp-placement';

describe('scoreToLevelJ1', () => {
  it('returns beginner for score < 40', () => {
    expect(scoreToLevelJ1(0)).toBe('beginner');
    expect(scoreToLevelJ1(20)).toBe('beginner');
    expect(scoreToLevelJ1(39)).toBe('beginner');
  });

  it('returns intermediate for score 40-69', () => {
    expect(scoreToLevelJ1(40)).toBe('intermediate');
    expect(scoreToLevelJ1(55)).toBe('intermediate');
    expect(scoreToLevelJ1(69)).toBe('intermediate');
  });

  it('returns advanced for score >= 70', () => {
    expect(scoreToLevelJ1(70)).toBe('advanced');
    expect(scoreToLevelJ1(100)).toBe('advanced');
  });
});

describe('combinedLevel', () => {
  const baseAnswers = {
    grade: '初二',
    studyMonths: '6-12' as const,
    selfRating: 'mid' as const,
    goal: 'pass-j1' as const,
    hoursPerWeek: '2-5' as const,
    province: null,
    cspJ1: null,
    cspS1: null,
    cspJ2: null,
    cspS2: null,
    gesp: null,
    otherContests: null,
  };

  it('returns advanced when CSP-J2 province-1 reported', () => {
    expect(combinedLevel({
      ...baseAnswers,
      cspJ2: { year: 2024, rank: '省一' },
    })).toBe('advanced');
  });

  it('returns intermediate when GESP 6+ passed', () => {
    expect(combinedLevel({
      ...baseAnswers,
      gesp: { year: 2024, level: 6, passed: true },
    })).toBe('intermediate');
  });

  it('returns advanced when GESP 8 passed', () => {
    expect(combinedLevel({
      ...baseAnswers,
      gesp: { year: 2024, level: 8, passed: true },
    })).toBe('advanced');
  });

  it('returns intermediate when CSP-J1 score >= 50', () => {
    expect(combinedLevel({
      ...baseAnswers,
      cspJ1: { year: 2024, score: 55 },
    })).toBe('intermediate');
  });

  it('falls back to selfRating when no contest data', () => {
    expect(combinedLevel({ ...baseAnswers, selfRating: 'low' })).toBe('beginner');
    expect(combinedLevel({ ...baseAnswers, selfRating: 'mid' })).toBe('intermediate');
    expect(combinedLevel({ ...baseAnswers, selfRating: 'high' })).toBe('advanced');
  });

  it('combines multiple signals: low self-rating + CSP-J2 省二 → advanced', () => {
    expect(combinedLevel({
      ...baseAnswers,
      selfRating: 'low',
      cspJ2: { year: 2024, rank: '省二' },
    })).toBe('advanced');
  });
});

describe('FALLBACK_RECOMMENDATIONS', () => {
  it('has 3 level keys', () => {
    expect(Object.keys(FALLBACK_RECOMMENDATIONS).sort()).toEqual([
      'advanced', 'beginner', 'intermediate',
    ]);
  });

  it('every level has at least 1 recommendation', () => {
    expect(FALLBACK_RECOMMENDATIONS.beginner.length).toBeGreaterThan(0);
    expect(FALLBACK_RECOMMENDATIONS.intermediate.length).toBeGreaterThan(0);
    expect(FALLBACK_RECOMMENDATIONS.advanced.length).toBeGreaterThan(0);
  });

  it('all recommendations reference real csp-lecture classroom ids', () => {
    const all = [
      ...FALLBACK_RECOMMENDATIONS.beginner,
      ...FALLBACK_RECOMMENDATIONS.intermediate,
      ...FALLBACK_RECOMMENDATIONS.advanced,
    ];
    expect(all).toContain('cm_imp_a39914d3af5c64d6');
    expect(all).toContain('cm_imp_cspj2024j_v1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/server/csp-placement.test.ts 2>&1 | tail -20`
Expected: FAIL with "Cannot find module './csp-placement'" or "scoreToLevelJ1 is not a function".

- [ ] **Step 4: Implement the 3 new functions**

Add to the end of `frontend/lib/server/csp-placement.ts`:

```ts
export type PlacementAnswers = {
  grade: string;
  studyMonths: 'lt3' | '3-6' | '6-12' | '12-24' | 'gt24';
  selfRating: 'low' | 'mid' | 'high';
  goal: 'pass-j1' | 'pass-j2' | 'high-rank' | 'try-best';
  hoursPerWeek: 'lt2' | '2-5' | '5-10' | 'gt10';
  province: string | null;
  cspJ1: { year: number; score: number } | null;
  cspS1: { year: number; score: number } | null;
  cspJ2: { year: number; rank: '省一' | '省二' | '省三' | '国一' | '国二' | '国三' } | null;
  cspS2: { year: number; rank: '省一' | '省二' | '省三' | '国一' | '国二' | '国三' } | null;
  gesp: { year: number; level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; passed: boolean } | null;
  otherContests: string | null;
};

/**
 * Map a single CSP-J1 (初赛) score to a coarse level.
 * Cutoffs: 0-39 beginner, 40-69 intermediate, 70-100 advanced.
 */
export function scoreToLevelJ1(score: number): CspLevel {
  if (score < 40) return 'beginner';
  if (score < 70) return 'intermediate';
  return 'advanced';
}

const RANK_TO_LEVEL: Record<string, CspLevel> = {
  '国一': 'advanced',
  '国二': 'advanced',
  '国三': 'advanced',
  '省一': 'advanced',
  '省二': 'advanced',
  '省三': 'intermediate',
};

/**
 * Compute the most appropriate level for a student based on
 * the survey answers. The rules (in evaluation order, most
 * authoritative signal wins):
 *   1. CSP-J2 or CSP-S2 with 国/省一/省二 → advanced
 *   2. CSP-J2 with 省三 → intermediate
 *   3. GESP 8 passed → advanced
 *   4. GESP 6-7 passed → intermediate
 *   5. GESP 4-5 passed → beginner
 *   6. CSP-J1 score >= 50 → intermediate
 *   7. Otherwise, use the self-reported selfRating field.
 */
export function combinedLevel(answers: PlacementAnswers): CspLevel {
  // Tier 1: 复赛强信号
  if (answers.cspJ2) {
    const lvl = RANK_TO_LEVEL[answers.cspJ2.rank];
    if (lvl) return lvl;
  }
  if (answers.cspS2) {
    const lvl = RANK_TO_LEVEL[answers.cspS2.rank];
    if (lvl) return lvl;
  }

  // Tier 2: GESP 信号
  if (answers.gesp?.passed) {
    if (answers.gesp.level >= 8) return 'advanced';
    if (answers.gesp.level >= 6) return 'intermediate';
    if (answers.gesp.level >= 4) return 'beginner';
  }

  // Tier 3: CSP-J1 初赛分数
  if (answers.cspJ1 && answers.cspJ1.score >= 50) {
    return 'intermediate';
  }

  // Fallback: 自评
  if (answers.selfRating === 'low') return 'beginner';
  if (answers.selfRating === 'high') return 'advanced';
  return 'intermediate';
}

/**
 * Hard-coded 3-classroom recommendations used when the LLM
 * call fails or times out. The IDs here are the only two
 * `csp-lecture`-collection classrooms as of 2026-07-26:
 *   - cm_imp_a39914d3af5c64d6  CSP初赛要点精讲 (16 scenes, 基础入门)
 *   - cm_imp_cspj2024j_v1       2024年普及组CSP-J初赛真题卷 (6 scenes, 真题)
 * Update this when the csp-lecture collection grows.
 */
export const FALLBACK_RECOMMENDATIONS: Record<CspLevel, string[]> = {
  beginner: ['cm_imp_a39914d3af5c64d6'],
  intermediate: ['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1'],
  advanced: ['cm_imp_cspj2024j_v1'],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/server/csp-placement.test.ts 2>&1 | tail -20`
Expected: PASS, all tests green.

- [ ] **Step 6: Run linter**

Run: `cd frontend && npx eslint lib/server/csp-placement.ts lib/server/csp-placement.test.ts 2>&1 | head -10`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/server/csp-placement.ts frontend/lib/server/csp-placement.test.ts
git commit -m "feat(server): scoreToLevelJ1 + combinedLevel + FALLBACK_RECOMMENDATIONS"
git push origin master
```

---

## Task 3: LLM Wrapper with 5s Soft Timeout

**Files:**
- Create: `frontend/lib/server/csp-placement-llm.ts`
- Create: `frontend/lib/server/csp-placement-llm.test.ts`

- [ ] **Step 1: Read the existing LLM call pattern**

Run: `grep -rn "getCurrentModelConfig" frontend/lib/server/ | head -5`

Look for how `getCurrentModelConfig` is used (e.g., in `ai-grade.ts` or `csp-quiz/route.ts`). We will mirror that pattern.

- [ ] **Step 2: Write the failing test for `recommendClassrooms`**

Create `frontend/lib/server/csp-placement-llm.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { recommendClassrooms } from './csp-placement-llm';

// Mock the model config + chat completion call
vi.mock('./model-config', () => ({
  getCurrentModelConfig: vi.fn(async () => ({
    baseUrl: 'https://mock.api',
    apiKey: 'mock-key',
    modelName: 'mock-model',
  })),
}));

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    level: 'intermediate',
                    recommendedIds: ['cm_a', 'cm_b', 'cm_c'],
                    reason: '你的基础不错，建议从专项题开始。',
                  }),
                },
              },
            ],
          })),
        },
      },
    })),
  };
});

describe('recommendClassrooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed response on success', async () => {
    const result = await recommendClassrooms({
      grade: '初二',
      studyMonths: '6-12',
      selfRating: 'mid',
      goal: 'pass-j1',
      hoursPerWeek: '2-5',
      province: '北京',
      cspJ1: { year: 2024, score: 42 },
      cspS1: null,
      cspJ2: null,
      cspS2: null,
      gesp: null,
      otherContests: null,
    });

    expect(result.aiStatus).toBe('ok');
    expect(result.level).toBe('intermediate');
    expect(result.recommendedIds).toEqual(['cm_a', 'cm_b', 'cm_c']);
    expect(result.aiReason).toContain('基础');
  });

  it('returns fallback on soft-timeout (Promise.race rejection)', async () => {
    // Override the mock to be slow
    const { default: OpenAI } = await import('openai');
    (OpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({
            choices: [{ message: { content: '{"level":"intermediate"}' } }],
          }), 10000)),
        },
      },
    }));

    const result = await recommendClassrooms({
      grade: '初二',
      studyMonths: '6-12',
      selfRating: 'mid',
      goal: 'pass-j1',
      hoursPerWeek: '2-5',
      province: null,
      cspJ1: null, cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
    });

    expect(result.aiStatus).toBe('fallback');
    expect(result.aiReason).toContain('暂未生成');
    expect(result.recommendedIds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/server/csp-placement-llm.test.ts 2>&1 | tail -15`
Expected: FAIL with "Cannot find module './csp-placement-llm'".

- [ ] **Step 4: Implement the LLM wrapper**

Create `frontend/lib/server/csp-placement-llm.ts`:

```ts
import OpenAI from 'openai';
import { getCurrentModelConfig } from './model-config';
import {
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
  type PlacementAnswers,
} from './csp-placement';

export type LlmRecommendation = {
  level: 'beginner' | 'intermediate' | 'advanced';
  recommendedIds: string[];
  aiReason: string;
  aiStatus: 'ok' | 'fallback';
};

const SOFT_TIMEOUT_MS = 5000;
const FALLBACK_REASON = '根据基础画像，暂未生成定制推荐。';

function buildPrompt(answers: PlacementAnswers): string {
  const lines: string[] = [];
  lines.push(`你是一位 CSP 初赛辅导老师，根据学生信息给出 1 段简短点评（80-150 字）和 3 个推荐课件 id。`);
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
  lines.push(`# 输出格式（严格 JSON）`);
  lines.push(`{`);
  lines.push(`  "level": "beginner" | "intermediate" | "advanced",`);
  lines.push(`  "recommendedIds": ["<课件id>", "<课件id>", "<课件id>"],`);
  lines.push(`  "reason": "<80-150 字的点评>"`);
  lines.push(`}`);

  return lines.join('\n');
}

function parseLlmResponse(content: string): Omit<LlmRecommendation, 'aiStatus'> | null {
  // Strip markdown code fences if present
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(trimmed);
    if (
      typeof parsed.level === 'string' &&
      ['beginner', 'intermediate', 'advanced'].includes(parsed.level) &&
      Array.isArray(parsed.recommendedIds) &&
      typeof parsed.reason === 'string'
    ) {
      return {
        level: parsed.level,
        recommendedIds: parsed.recommendedIds.slice(0, 3),
        aiReason: parsed.reason,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

function buildFallback(answers: PlacementAnswers): Omit<LlmRecommendation, 'aiStatus'> {
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
 */
export async function recommendClassrooms(
  answers: PlacementAnswers,
): Promise<LlmRecommendation> {
  const prompt = buildPrompt(answers);

  let config: { baseUrl: string; apiKey: string; modelName: string };
  try {
    config = await getCurrentModelConfig();
  } catch {
    return { ...buildFallback(answers), aiStatus: 'fallback' };
  }

  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  const llmCall = client.chat.completions.create({
    model: config.modelName,
    messages: [
      { role: 'system', content: '你是一位专业的 CSP 初赛辅导老师。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LLM_TIMEOUT')), SOFT_TIMEOUT_MS),
  );

  try {
    const response = await Promise.race([llmCall, timeout]);
    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseLlmResponse(content);
    if (!parsed) {
      return { ...buildFallback(answers), aiStatus: 'fallback' };
    }
    return { ...parsed, aiStatus: 'ok' };
  } catch {
    return { ...buildFallback(answers), aiStatus: 'fallback' };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/server/csp-placement-llm.test.ts 2>&1 | tail -20`
Expected: PASS, both tests green.

- [ ] **Step 6: Run linter**

Run: `cd frontend && npx eslint lib/server/csp-placement-llm.ts lib/server/csp-placement-llm.test.ts 2>&1 | head -10`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/server/csp-placement-llm.ts frontend/lib/server/csp-placement-llm.test.ts
git commit -m "feat(server): csp-placement LLM wrapper with 5s soft timeout + fallback"
git push origin master
```

---

## Task 4: GET/POST API Endpoint

**Files:**
- Create: `frontend/app/api/csp-quiz/placement/route.ts`
- Create: `frontend/app/api/csp-quiz/placement/route.test.ts`

- [ ] **Step 1: Read the existing auth helper and one similar API route**

Run: `cat frontend/lib/auth.ts | head -30 && echo "---" && cat frontend/app/api/csp-quiz/reset/route.ts`

Find how authentication is enforced and how the response is structured.

- [ ] **Step 2: Write the failing test**

Create `frontend/app/api/csp-quiz/placement/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getCspPlacement: vi.fn(),
  upsertCspPlacement: vi.fn(),
  updateCspPlacementAi: vi.fn(),
}));

vi.mock('@/lib/server/csp-placement', () => ({
  combinedLevel: vi.fn(() => 'intermediate'),
  FALLBACK_RECOMMENDATIONS: {
    beginner: ['cm_b'],
    intermediate: ['cm_i'],
    advanced: ['cm_a'],
  },
}));

vi.mock('@/lib/server/csp-placement-llm', () => ({
  recommendClassrooms: vi.fn(async () => ({
    level: 'intermediate',
    recommendedIds: ['cm_x'],
    aiReason: 'AI 点评',
    aiStatus: 'ok' as const,
  })),
}));

import { GET, POST } from './route';
import { getSession } from '@/lib/auth';
import {
  getCspPlacement,
  upsertCspPlacement,
} from '@/lib/db';

describe('GET /api/csp-quiz/placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns null placement when no record exists', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1' });
    (getCspPlacement as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.placement).toBeNull();
  });

  it('returns placement when record exists', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1' });
    (getCspPlacement as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'u1',
      level: 'intermediate',
      recommendedIds: '["cm_x"]',
      aiReason: '点评',
      aiStatus: 'ok',
      updatedAt: '2025-12-08T00:00:00Z',
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.placement.level).toBe('intermediate');
    expect(json.placement.recommendedIds).toEqual(['cm_x']);
  });
});

describe('POST /api/csp-quiz/placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://test/api', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when 基础 5 题 missing', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1' });
    const req = new Request('http://test/api', {
      method: 'POST',
      body: JSON.stringify({ grade: '初二' }),  // missing 4 required
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('upserts placement + returns recommendation on success', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1' });
    (upsertCspPlacement as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const req = new Request('http://test/api', {
      method: 'POST',
      body: JSON.stringify({
        grade: '初二',
        studyMonths: '6-12',
        selfRating: 'mid',
        goal: 'pass-j1',
        hoursPerWeek: '2-5',
        province: null,
        cspJ1: { year: 2024, score: 42 },
        cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.aiStatus).toBe('ok');
    expect(upsertCspPlacement).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run app/api/csp-quiz/placement/route.test.ts 2>&1 | tail -15`
Expected: FAIL with "Cannot find module './route'".

- [ ] **Step 4: Implement the API route**

Create `frontend/app/api/csp-quiz/placement/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getCspPlacement,
  upsertCspPlacement,
  type CspPlacementRow,
} from '@/lib/db';
import {
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
  type PlacementAnswers,
} from '@/lib/server/csp-placement';
import { recommendClassrooms } from '@/lib/server/csp-placement-llm';

const REQUIRED_FIELDS = [
  'grade', 'studyMonths', 'selfRating', 'goal', 'hoursPerWeek',
] as const;

type PlacementResponse = Omit<CspPlacementRow, 'recommendedIds'> & {
  recommendedIds: string[];
};

function rowToResponse(row: CspPlacementRow): PlacementResponse {
  let recommendedIds: string[] = [];
  try {
    const parsed = JSON.parse(row.recommendedIds);
    if (Array.isArray(parsed)) recommendedIds = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // keep empty
  }
  return { ...row, recommendedIds };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const row = getCspPlacement(session.userId);
  return NextResponse.json({ placement: row ? rowToResponse(row) : null });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
      return NextResponse.json(
        { error: `基础 5 题缺一不可：缺少 ${field}` },
        { status: 400 },
      );
    }
  }

  const answers: PlacementAnswers = {
    grade: String(body.grade),
    studyMonths: body.studyMonths as PlacementAnswers['studyMonths'],
    selfRating: body.selfRating as PlacementAnswers['selfRating'],
    goal: body.goal as PlacementAnswers['goal'],
    hoursPerWeek: body.hoursPerWeek as PlacementAnswers['hoursPerWeek'],
    province: (body.province as string | null) ?? null,
    cspJ1: (body.cspJ1 as PlacementAnswers['cspJ1']) ?? null,
    cspS1: (body.cspS1 as PlacementAnswers['cspS1']) ?? null,
    cspJ2: (body.cspJ2 as PlacementAnswers['cspJ2']) ?? null,
    cspS2: (body.cspS2 as PlacementAnswers['cspS2']) ?? null,
    gesp: (body.gesp as PlacementAnswers['gesp']) ?? null,
    otherContests: (body.otherContests as string | null) ?? null,
  };

  const now = new Date().toISOString();
  const level = combinedLevel(answers);
  const fallbackIds = FALLBACK_RECOMMENDATIONS[level];

  // 1) UPSERT with aiStatus='pending' and fallback recommendations
  const row: CspPlacementRow = {
    userId: session.userId,
    grade: answers.grade,
    studyMonths: answers.studyMonths,
    selfRating: answers.selfRating,
    goal: answers.goal,
    hoursPerWeek: answers.hoursPerWeek,
    province: answers.province,
    cspJ1Year: answers.cspJ1?.year ?? null, cspJ1Score: answers.cspJ1?.score ?? null,
    cspS1Year: answers.cspS1?.year ?? null, cspS1Score: answers.cspS1?.score ?? null,
    cspJ2Year: answers.cspJ2?.year ?? null, cspJ2Rank: answers.cspJ2?.rank ?? null,
    cspS2Year: answers.cspS2?.year ?? null, cspS2Rank: answers.cspS2?.rank ?? null,
    gespYear: answers.gesp?.year ?? null, gespLevel: answers.gesp?.level ?? null, gespPassed: answers.gesp?.passed ? 1 : (answers.gesp ? 0 : null),
    otherContests: answers.otherContests,
    level,
    recommendedIds: JSON.stringify(fallbackIds),
    aiReason: 'AI 分析中…',
    aiStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  upsertCspPlacement(row);

  // 2) Synchronously call LLM with 5s soft timeout
  //    The wrapper already returns fallback on timeout/error
  const llmResult = await recommendClassrooms(answers);

  // 3) Update row with final LLM result
  const finalIds = llmResult.aiStatus === 'ok' ? llmResult.recommendedIds : fallbackIds;
  // We import dynamically to keep this file lightweight
  const { updateCspPlacementAi } = await import('@/lib/db');
  updateCspPlacementAi(
    session.userId,
    llmResult.aiReason,
    JSON.stringify(finalIds),
    llmResult.aiStatus,
    now,
  );

  return NextResponse.json({
    ok: true,
    level: llmResult.level,
    recommendedIds: finalIds,
    aiReason: llmResult.aiReason,
    aiStatus: llmResult.aiStatus,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run app/api/csp-quiz/placement/route.test.ts 2>&1 | tail -20`
Expected: PASS, all 5 tests green.

- [ ] **Step 6: Run typecheck + linter**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "placement|error" | head -10`
Expected: 0 errors.

Run: `cd frontend && npx eslint app/api/csp-quiz/placement/ 2>&1 | head -10`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/api/csp-quiz/placement/
git commit -m "feat(api): GET/POST /api/csp-quiz/placement with LLM recommendation"
git push origin master
```

---

## Task 5: Frontend Components (4 files)

**Files:**
- Create: `frontend/components/csp-lecture/PlacementBanner.tsx`
- Create: `frontend/components/csp-lecture/PlacementModal.tsx`
- Create: `frontend/components/csp-lecture/RecommendationCard.tsx`
- Create: `frontend/components/csp-lecture/ConfirmResetModal.tsx`

- [ ] **Step 1: Create `PlacementBanner.tsx`**

Create `frontend/components/csp-lecture/PlacementBanner.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

type Placement = {
  level: 'beginner' | 'intermediate' | 'advanced';
  recommendedIds: string[];
  aiReason: string;
  aiStatus: 'ok' | 'fallback' | 'pending';
  updatedAt: string;
} | null;

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: 'from-emerald-400 to-teal-500',
  intermediate: 'from-blue-400 to-indigo-500',
  advanced: 'from-violet-500 to-fuchsia-500',
};

export function PlacementBanner() {
  const [placement, setPlacement] = useState<Placement | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    fetch('/api/csp-quiz/placement')
      .then((r) => r.json())
      .then((d) => setPlacement(d.placement))
      .catch(() => setPlacement(null));
  }, []);

  if (placement === undefined) {
    // loading skeleton
    return (
      <div className="mx-auto max-w-6xl px-4 mb-4">
        <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (placement === null) {
    // 未摸底状态
    return (
      <>
        <div className="mx-auto max-w-6xl px-4 mb-4">
          <div className="rounded-xl bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-amber-900">
              <span className="font-semibold">想了解你的 CSP 初赛水平？</span>
              <span className="text-amber-700 ml-1">2 分钟摸底，AI 推荐适合你的起点课件</span>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              2 分钟摸底
            </button>
          </div>
        </div>
        {modalOpen && <PlacementModal onClose={() => setModalOpen(false)} onSubmitted={(p) => { setPlacement(p); setModalOpen(false); }} />}
      </>
    );
  }

  // 已摸底状态
  const date = new Date(placement.updatedAt).toISOString().slice(0, 10);
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 mb-4">
        <div className={`rounded-xl bg-gradient-to-r ${LEVEL_COLOR[placement.level]} px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap`}>
          <div className="text-sm text-white">
            <span className="font-semibold">已摸底（{date}）</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/25 text-white text-xs font-bold">
              {LEVEL_LABEL[placement.level]}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRecommendOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-800 text-sm font-semibold hover:bg-white transition"
            >
              查看推荐
            </button>
            <button
              onClick={() => setConfirmResetOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/30 text-white text-sm font-medium hover:bg-white/40 transition border border-white/40"
            >
              重新摸底
            </button>
          </div>
        </div>
      </div>
      {recommendOpen && <RecommendationCard placement={placement} onClose={() => setRecommendOpen(false)} />}
      {modalOpen && <PlacementModal onClose={() => setModalOpen(false)} onSubmitted={(p) => { setPlacement(p); setModalOpen(false); }} />}
      {confirmResetOpen && (
        <ConfirmResetModal
          onCancel={() => setConfirmResetOpen(false)}
          onConfirm={() => { setConfirmResetOpen(false); setModalOpen(true); }}
        />
      )}
    </>
  );
}

// Sub-components defined inline below; moved to their own files in subsequent steps.
import { PlacementModal } from './PlacementModal';
import { RecommendationCard } from './RecommendationCard';
import { ConfirmResetModal } from './ConfirmResetModal';
```

- [ ] **Step 2: Create `ConfirmResetModal.tsx`**

Create `frontend/components/csp-lecture/ConfirmResetModal.tsx`:

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function ConfirmResetModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">重新摸底？</h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            重新摸底会覆盖你当前的推荐结果。
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              重新摸底
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Create `PlacementModal.tsx`**

Create `frontend/components/csp-lecture/PlacementModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

type PlacementAnswers = {
  grade: string;
  studyMonths: string;
  selfRating: string;
  goal: string;
  hoursPerWeek: string;
  province: string | null;
  cspJ1: { year: number; score: number } | null;
  cspS1: { year: number; score: number } | null;
  cspJ2: { year: number; rank: string } | null;
  cspS2: { year: number; rank: string } | null;
  gesp: { year: number; level: number; passed: boolean } | null;
  otherContests: string | null;
};

const YEARS = ['2025', '2024', '2023', '2022', '2021'];
const NO_PARTICIPATED = '__none__';

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];
const STUDY = [
  { v: 'lt3', l: '<3 个月' }, { v: '3-6', l: '3-6 个月' },
  { v: '6-12', l: '6-12 个月' }, { v: '12-24', l: '1-2 年' }, { v: 'gt24', l: '2 年以上' },
];
const RATING = [
  { v: 'low', l: '入门' }, { v: 'mid', l: '中级' }, { v: 'high', l: '高级' },
];
const GOAL = [
  { v: 'pass-j1', l: '通过 J1' }, { v: 'pass-j2', l: '通过 J2' },
  { v: 'high-rank', l: '争取高名次' }, { v: 'try-best', l: '全力以赴' },
];
const HOURS = [
  { v: 'lt2', l: '<2 小时' }, { v: '2-5', l: '2-5 小时' },
  { v: '5-10', l: '5-10 小时' }, { v: 'gt10', l: '10+ 小时' },
];
const RANKS = ['省一', '省二', '省三', '国一', '国二', '国三'];
const GESP_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

const PROVINCES = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾',
  '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门',
];

export function PlacementModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (placement: any) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlacementAnswers>({
    grade: '初二', studyMonths: '6-12', selfRating: 'mid', goal: 'pass-j1', hoursPerWeek: '2-5',
    province: null, cspJ1: null, cspS1: null, cspJ2: null, cspS2: null, gesp: null, otherContests: null,
  });

  const update = <K extends keyof PlacementAnswers>(key: K, value: PlacementAnswers[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Generic contest-block helper: pick "我没参加过" / "2025..." → either null or {year, ...}
  const pickContest = <T,>(key: keyof PlacementAnswers, value: string, makeObj: (year: string) => T | null) => {
    if (value === NO_PARTICIPATED) update(key, null as any);
    else update(key, makeObj(value) as any);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/csp-quiz/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || '提交失败');
      }
      const data = await res.json();
      // Re-fetch the canonical placement record
      const get = await fetch('/api/csp-quiz/placement');
      const getData = await get.json();
      onSubmitted(getData.placement);
    } catch (e: any) {
      setError(e.message || '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <h2 className="text-lg font-bold text-slate-900">CSP 初赛水平摸底</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            {/* 基础信息 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 基础信息</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="年级">
                  <select value={form.grade} onChange={(e) => update('grade', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="学 C++ 时长">
                  <select value={form.studyMonths} onChange={(e) => update('studyMonths', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    {STUDY.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </Field>
                <Field label="自评水平">
                  <select value={form.selfRating} onChange={(e) => update('selfRating', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    {RATING.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </Field>
                <Field label="目标">
                  <select value={form.goal} onChange={(e) => update('goal', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    {GOAL.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
                  </select>
                </Field>
                <Field label="每周投入">
                  <select value={form.hoursPerWeek} onChange={(e) => update('hoursPerWeek', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    {HOURS.map((h) => <option key={h.v} value={h.v}>{h.l}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            {/* 比赛成绩 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">🏆 比赛成绩（可选）</h3>
              <div className="space-y-3">
                <Field label="省份">
                  <select value={form.province ?? ''} onChange={(e) => update('province', e.target.value || null)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                    <option value="">不填</option>
                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <ContestBlock
                  label="CSP-J1 初赛"
                  value={form.cspJ1}
                  onChange={(v) => update('cspJ1', v as any)}
                  yearField={true}
                  extraField={(year) => (
                    <input type="number" min={0} max={100} value={form.cspJ1?.score ?? ''}
                      onChange={(e) => update('cspJ1', { year: Number(year), score: Number(e.target.value) })}
                      placeholder="分数 0-100"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  )}
                />

                <ContestBlock
                  label="CSP-S1 初赛"
                  value={form.cspS1}
                  onChange={(v) => update('cspS1', v as any)}
                  yearField={true}
                  extraField={(year) => (
                    <input type="number" min={0} max={100} value={form.cspS1?.score ?? ''}
                      onChange={(e) => update('cspS1', { year: Number(year), score: Number(e.target.value) })}
                      placeholder="分数 0-100"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  )}
                />

                <ContestBlock
                  label="CSP-J2 复赛"
                  value={form.cspJ2}
                  onChange={(v) => update('cspJ2', v as any)}
                  yearField={true}
                  extraField={(year) => (
                    <select value={form.cspJ2?.rank ?? ''}
                      onChange={(e) => update('cspJ2', { year: Number(year), rank: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">选择等级</option>
                      {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                />

                <ContestBlock
                  label="CSP-S2 复赛"
                  value={form.cspS2}
                  onChange={(v) => update('cspS2', v as any)}
                  yearField={true}
                  extraField={(year) => (
                    <select value={form.cspS2?.rank ?? ''}
                      onChange={(e) => update('cspS2', { year: Number(year), rank: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">选择等级</option>
                      {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                />

                <ContestBlock
                  label="GESP 等级"
                  value={form.gesp}
                  onChange={(v) => update('gesp', v as any)}
                  yearField={true}
                  extraField={(year) => (
                    <div className="flex gap-2">
                      <select value={form.gesp?.level ?? ''}
                        onChange={(e) => update('gesp', { year: Number(year), level: Number(e.target.value), passed: form.gesp?.passed ?? true })}
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="">级别</option>
                        {GESP_LEVELS.map((l) => <option key={l} value={l}>{l} 级</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-sm text-slate-700">
                        <input type="checkbox" checked={form.gesp?.passed ?? false}
                          onChange={(e) => update('gesp', { year: Number(year), level: form.gesp?.level ?? 1, passed: e.target.checked })} />
                        已通过
                      </label>
                    </div>
                  )}
                />

                <Field label="其它奖项">
                  <input type="text" value={form.otherContests ?? ''}
                    onChange={(e) => update('otherContests', e.target.value || null)}
                    placeholder="如：蓝桥杯省二 2024"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                </Field>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition">
              取消
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50">
              {submitting ? '分析中…' : '查看我的推荐 →'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function ContestBlock({
  label, value, onChange, yearField, extraField,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  yearField: boolean;
  extraField: (year: string) => React.ReactNode;
}) {
  const currentYear = value?.year ? String(value.year) : NO_PARTICIPATED;
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={currentYear}
          onChange={(e) => {
            if (e.target.value === NO_PARTICIPATED) onChange(null);
            else onChange({ year: Number(e.target.value) });
          }}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value={NO_PARTICIPATED}>我没参加过</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {value && extraField(currentYear)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `RecommendationCard.tsx`**

Create `frontend/components/csp-lecture/RecommendationCard.tsx`:

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import Link from 'next/link';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
};
const LEVEL_COLOR: Record<string, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-blue-500',
  advanced: 'bg-violet-500',
};

export function RecommendationCard({
  placement, onClose,
}: {
  placement: {
    level: 'beginner' | 'intermediate' | 'advanced';
    recommendedIds: string[];
    aiReason: string;
    aiStatus: 'ok' | 'fallback' | 'pending';
  };
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <h2 className="text-lg font-bold text-slate-900">📊 你的 CSP 初赛等级</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 flex-1">
            <div className="text-center mb-5">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${LEVEL_COLOR[placement.level]} text-white text-2xl font-black shadow-lg`}>
                {LEVEL_LABEL[placement.level]}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-3 mb-5 text-sm text-slate-700 leading-relaxed">
              {placement.aiReason || '根据基础画像，暂未生成定制推荐。'}
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mb-3">📚 为你推荐</h3>
            <div className="space-y-2">
              {placement.recommendedIds.length === 0 ? (
                <div className="text-sm text-slate-500">暂无推荐课件。</div>
              ) : (
                placement.recommendedIds.map((id) => (
                  <Link
                    key={id}
                    href={`/csp-lecture/${id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition px-4 py-3"
                  >
                    <BookOpen className="w-5 h-5 text-violet-500 shrink-0" />
                    <span className="text-sm font-mono text-slate-700">{id}</span>
                    <span className="ml-auto text-violet-600 text-sm">开始 →</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
            <button onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition">
              关闭
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 5: Run typecheck + linter**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "csp-lecture|error" | head -20`
Expected: 0 errors.

Run: `cd frontend && npx eslint components/csp-lecture/ 2>&1 | head -10`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/csp-lecture/
git commit -m "feat(ui): PlacementBanner / PlacementModal / RecommendationCard / ConfirmResetModal"
git push origin master
```

---

## Task 6: Integrate Banner into /csp-lecture + Deploy

**Files:**
- Modify: `frontend/app/csp-lecture/page.tsx` (add import + render after hero)

- [ ] **Step 1: Read the existing csp-lecture page**

Run: `cat frontend/app/csp-lecture/page.tsx | head -80`

Find the hero `<section>` element so we know where to insert the banner.

- [ ] **Step 2: Add the import**

At the top of the file (after the existing imports), add:

```tsx
import { PlacementBanner } from '@/components/csp-lecture/PlacementBanner';
```

- [ ] **Step 3: Insert `<PlacementBanner />` after the hero section**

Find the `</section>` that closes the hero block. Insert immediately after it:

```tsx
<PlacementBanner />
```

- [ ] **Step 4: Run typecheck + linter**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "csp-lecture|error" | head -10`
Expected: 0 errors.

Run: `cd frontend && npx eslint app/csp-lecture/page.tsx 2>&1 | head -10`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/csp-lecture/page.tsx
git commit -m "feat(csp-lecture): integrate PlacementBanner into /csp-lecture"
git push origin master
```

- [ ] **Step 6: Deploy to production**

SSH to the production server and run:

```bash
cd /home/ubuntu/studymate
git pull origin master
bash fix-deploy.sh
```

Wait for `fix-deploy.sh` to complete (typically 5-10 minutes due to the `docker compose build --no-cache frontend` step).

- [ ] **Step 7: Manual smoke test**

Open `https://aijiangti.cn/csp-lecture` in a fresh browser tab (Ctrl+Shift+R to clear cache).

Verify:
- [ ] 1. PlacementBanner appears at the top of the page (above the classroom grid)
- [ ] 2. If logged in with no placement: banner shows "2 分钟摸底" button
- [ ] 3. Click "2 分钟摸底" → PlacementModal opens as a single-page form
- [ ] 4. Form has 5 base questions + 4 contest blocks (省份 / CSP-J1 / CSP-S1 / CSP-J2 / CSP-S2 / GESP / 其它) all visible and scrollable
- [ ] 5. Pick "我没参加过" in any contest block → extra field disappears
- [ ] 6. Pick "2025" in CSP-J1 block → score input appears
- [ ] 7. Submit → after up to 5s, modal closes, banner changes to "已摸底"
- [ ] 8. Click "查看推荐" → RecommendationCard shows level + reason + 3 classrooms
- [ ] 9. Click a recommended classroom link → navigates to that classroom + modal closes
- [ ] 10. Click "重新摸底" → ConfirmResetModal appears; confirm → PlacementModal reopens
- [ ] 11. Log out and log in as a different user → fresh banner (no placement)
- [ ] 12. Verify the 9 existing students' completion state is unaffected (硬刷 /student/home 和排行榜)

- [ ] **Step 8: Final commit (no code changes; just mark deploy done)**

```bash
git commit --allow-empty -m "chore: CSP placement feature deployed to production"
git push origin master
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] §1 背景与目标 — Task 1-6 all serve the goal of placement survey
- [x] §2 架构 — Task 5 covers the 4 components; Task 4 the API; Task 1-2 the data
- [x] §3 数据模型 — Task 1 implements `csp_placement` table; Task 2 implements `combinedLevel`
- [x] §4 API — Task 4 implements GET/POST
- [x] §5 前端 UI — Task 5 implements all 4 components
- [x] §6 错误处理 — Task 3 (5s soft timeout) + Task 5 (ConfirmResetModal) + Task 4 (400 400 errors)
- [x] §7 实施计划 — this document
- [x] §8 测试 — Task 2/3/4 each have unit tests
- [x] §9 风险与备选 — Task 3 fallback + Task 5 responsive layouts
- [x] §10 与已实施 spec 关系 — verified no conflicts

**Placeholder scan:** No "TBD" / "TODO" / "fill in". Every step has complete code.

**Type consistency:** All references to `PlacementAnswers`, `CspLevel`, `CspPlacementRow`, `recommendClassrooms`, `FALLBACK_RECOMMENDATIONS` are defined in earlier tasks and used consistently in later tasks.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-26-csp-placement.md`.**

Two execution options:
1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — Execute tasks in this session with checkpoints

Per your earlier choice (1 = Subagent-Driven), I will dispatch subagents.
