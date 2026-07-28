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
  // CSP 复赛奖项只有一等奖 / 二等奖 / 三等奖 三档，不再区分
  // 省奖和国奖（产品决定：用户问就是 1/2/3 等）。TypeScript 用
  // 字面量联合约束 UI 下拉，旧数据里残留的"省一"等值在写入
  // 之前会被前端表单挡住；已有的库行只影响 combinedLevel 的
  // 旧值（这条规则只读老数据时仍会查表 miss 然后 fallback
  // 到 selfRating）。
  cspJ2: { year: number; rank: '一等奖' | '二等奖' | '三等奖' } | null;
  cspS2: { year: number; rank: '一等奖' | '二等奖' | '三等奖' } | null;
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

// CSP 复赛奖项 → 等级。复赛能拿奖已经说明实力强过大部分人：
//   一等奖 → 高级 (advanced)
//   二等奖 → 中级 (intermediate)
//   三等奖 → 入门 (beginner)
const RANK_TO_LEVEL: Record<string, CspLevel> = {
  一等奖: 'advanced',
  二等奖: 'intermediate',
  三等奖: 'beginner',
};

/**
 * Compute the most appropriate level for a student based on
 * the survey answers. The rules (in evaluation order, most
 * authoritative signal wins):
 *   1. CSP-J2 or CSP-S2 with 一等奖 → advanced; 二等奖 →
 *      intermediate; 三等奖 → beginner
 *   2. GESP 8 passed → advanced
 *   3. GESP 6-7 passed → intermediate
 *   4. GESP 4-5 passed → beginner
 *   5. CSP-J1 score >= 50 → intermediate
 *   6. Otherwise, use the self-reported selfRating field.
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
 * call fails or times out. The IDs here are the two
 * `csp-lecture`-collection anchor classrooms that have been
 * around since 2026-07-26:
 *   - cm_imp_a39914d3af5c64d6  CSP初赛要点精讲 (基础入门)
 *   - cm_imp_cspj2024j_v1       2024年普及组CSP-J初赛真题卷 (真题)
 *
 * This is only consulted by `filterToValidIds` and the
 * level-based fallback in `scoreClassroomsForLevel` when the
 * live allowlist is empty / the heuristic can't find a good
 * match. Both fall through to this map so we always have
 * *something* to show, even if the LLM is down and the
 * operator hasn't uploaded any new courseware yet.
 */
export const FALLBACK_RECOMMENDATIONS: Record<CspLevel, string[]> = {
  beginner: ['cm_imp_a39914d3af5c64d6'],
  intermediate: ['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1'],
  advanced: ['cm_imp_cspj2024j_v1'],
};

/**
 * Heuristically score every available classroom against a target
 * level. Returns the top N id+title pairs.
 *
 * Why this exists in addition to the FALLBACK_RECOMMENDATIONS map:
 *   - The hard-coded map only knows 2 classrooms. Once the operator
 *     has uploaded 10+ (e.g. 精讲1-7 + 真题卷), we want the
 *     fallback to also surface the new ones instead of showing the
 *     same 1-2 every time.
 *   - "Random" recommendations feel random because the LLM has no
 *     content context (just ids). The deterministic heuristic here
 *     uses the classroom title's leading numbering + keyword
 *     scoring to pick a *consistent* set per level. If the LLM
 *     is healthy, the LLM picks — this function is the safety net
 *     and also the seed list when no other signal exists.
 *
 * Scoring rules (additive, no negatives — order is the tiebreaker):
 *   - Title starts with a leading "N、" / "N,":
 *       low N (1-3)  → +6 / +4 / +2 (matches "beginner" / "intermediate" / "advanced")
 *       high N (≥ 7) → reverse: beginner +0, intermediate +2, advanced +6
 *   - Title contains "真题" / "2024" / "2025" / "2026" or "刷题" → +5 for advanced / intermediate, +1 for beginner
 *   - Title contains "入门" / "基础" → +6 for beginner, +0 for advanced
 *   - Title contains "进阶" / "提高" / "高级" → +6 for advanced
 *   - Has any "csp" / "CSP" substring (almost all do) → +1 for every level
 *   - Otherwise → +0 (level-neutral)
 *
 * The function never throws and always returns at most `limit`
 * items; if the available list is empty it falls back to
 * FALLBACK_RECOMMENDATIONS[level] for the first 1-2 ids.
 */
type ScoredClassroom = { id: string; title: string; score: number };
const STOP_WORDS = /csp|要点精讲|精讲/gi;
export function scoreClassroomsForLevel(
  level: CspLevel,
  available: { id: string; title: string }[],
  limit = 3,
): { id: string; title: string }[] {
  if (available.length === 0) {
    // No live classrooms — return the hard-coded anchor list.
    const fallback = FALLBACK_RECOMMENDATIONS[level] ?? [];
    return fallback.map((id) => ({ id, title: id }));
  }
  const scored: ScoredClassroom[] = available.map((c) => {
    const title = c.title ?? '';
    let score = 0;
    // Leading "N、" / "N," / "N.": low numbers are beginner-curriculum
    // walkthroughs; high numbers are advanced topics.
    const lead = title.match(/^\s*(\d+)\s*[,、.]\s*/);
    if (lead) {
      const n = parseInt(lead[1], 10);
      if (n <= 7) {
        // beginner favours the lowest Ns, advanced the highest
        const rank = 8 - n; // 1→7, 7→1
        if (level === 'beginner') score += rank;
        else if (level === 'intermediate') score += Math.max(1, rank - 2);
        else score += rank >= 6 ? 4 : 1;
      }
    }
    // 真题 / 刷题 / 比赛年份关键词 — 真题卷对中级最有用
    if (/真题|刷题|2024|2025|2026/.test(title)) {
      score += level === 'beginner' ? 1 : 5;
    }
    // 入门 / 基础关键词
    if (/入门|基础|准备/.test(title)) {
      score += level === 'beginner' ? 6 : level === 'intermediate' ? 2 : 0;
    }
    // 进阶 / 提高 / 高级关键词
    if (/进阶|提高|高级|深挖|深入/.test(title)) {
      score += level === 'advanced' ? 6 : level === 'intermediate' ? 2 : 0;
    }
    // 一概 / 概览 / 题型一览 (overview pieces are useful for any level)
    if (/概览|一览|总览|题型/.test(title)) {
      score += 2;
    }
    // 包含 CSP 字样：几乎所有都含，给 +1 兜底让 keyword 未命中的也有得分
    if (/csp/i.test(title)) score += 1;
    // Strip the stop-words for the final ordering key — purely cosmetic
    // (used as the secondary sort to keep output stable across calls
    // when scores tie).
    void title.replace(STOP_WORDS, '');
    return { id: c.id, title: c.title, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable tiebreaker: shorter title first, then alphabetical.
    if (a.title.length !== b.title.length) return a.title.length - b.title.length;
    return a.title.localeCompare(b.title, 'zh-CN');
  });
  return scored.slice(0, limit).map((s) => ({ id: s.id, title: s.title }));
}
