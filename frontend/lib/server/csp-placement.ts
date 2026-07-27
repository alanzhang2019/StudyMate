// Score → level mapping for CSP final papers and (future) placement quiz.
//
// 2026-07-26 extracted from spec 2026-07-26-csp-final-paper-submit-design.md.
// The level buckets are intentionally aligned with the placement quiz's
// beginner/intermediate/advanced buckets (see brainstorm: B 方案 + 5 题基础
// + 4 个比赛区块 + AI 推荐 A 方案). When the placement feature ships, the
// leaderboard and recommendation engine will both consume this function.
//
// Buckets (cumulative):
//   0-30  → beginner       (入门)
//   31-70 → intermediate   (中级)
//   71-100 → advanced      (高级)

export type CspLevel = 'beginner' | 'intermediate' | 'advanced';

export function scoreToLevel(score: number): CspLevel {
  if (score < 0) return 'beginner';
  if (score <= 30) return 'beginner';
  if (score <= 70) return 'intermediate';
  return 'advanced';
}

export function levelLabel(level: CspLevel): string {
  switch (level) {
    case 'beginner':
      return '入门';
    case 'intermediate':
      return '中级';
    case 'advanced':
      return '高级';
  }
}

// ─── Placement (摸底) — added 2026-07-26 with csp-placement spec ─────────

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
