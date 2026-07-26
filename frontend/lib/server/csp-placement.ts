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
