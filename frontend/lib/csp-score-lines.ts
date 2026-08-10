// /lib/csp-score-lines.ts
//
// 历年真题的"晋级线 / 奖项线"参考数据。
//
// 用途 (当前 / 未来)：
//   1. /csp-lecture K 线图：在每一年画 4 条 markLine
//      （广东晋级 / 全国一等 / 二等 / 三等），让学生一眼看出
//      "今年我多少分，离晋级还差多少"。
//   2. AI 分析报告：在总体诊断里给一句"本次得分超过 N 年
//      J/S 组广东晋级线（XX 分）"作为定性参考。
//   3. 后续可以在 /student/home 加一个"晋级预测"模块，
//      拿最新一年分数线对标本人得分，提示"距离晋级还差 XX 分"。
//
// 数据范围：2019–2025 共 7 年。
// 数据来源：用户 2026-08-10 提供的截图（广东省 + 全国一二三等）。
//
// 注意：满分 100 分（单项选择 30 + 阅读程序 30 + 完善程序 40）。
// 部分年份 J/S 满分细则不同，但分数线上表统一为百分制。
//
// 字段说明：
//   - year:        考试年份
//   - group:       'J' = 普及组, 'S' = 提高组
//   - promotion:   广东省晋级线（CCF 公布的广东省分数门槛）
//   - first:       全国一等奖分数线
//   - second:      全国二等奖分数线
//   - third:       全国三等奖分数线
//
// 如果某一年某条线缺失（早期年份 / 数据未收集），定义为 undefined。
// UI 层遇到 undefined 时不画对应的 markLine。

export type CspGroup = 'J' | 'S';

export interface YearlyScoreLine {
  year: number;
  group: CspGroup;
  /** 广东晋级线（CCF 公布分数） */
  promotion: number;
  /** 全国一等奖线 */
  first: number;
  /** 全国二等奖线 */
  second: number;
  /** 全国三等奖线 */
  third: number;
}

/**
 * 广东晋级 + 全国一/二/三等 分数线，2019–2025。
 * 顺序：年份升序，外部按需要切片 / 排序。
 */
export const SCORE_LINES: YearlyScoreLine[] = [
  // ── J 组（普及组） ───────────────────────────────────
  { year: 2019, group: 'J', promotion: 72, first: 80, second: 56, third: 38 },
  { year: 2020, group: 'J', promotion: 68, first: 70, second: 50, third: 36 },
  { year: 2021, group: 'J', promotion: 62, first: 60, second: 45, third: 30 },
  { year: 2022, group: 'J', promotion: 69.5, first: 64, second: 45, third: 30 },
  { year: 2023, group: 'J', promotion: 68.5, first: 63, second: 47, third: 33 },
  { year: 2024, group: 'J', promotion: 83.5, first: 81, second: 62, third: 44 },
  { year: 2025, group: 'J', promotion: 59.5, first: 63.5, second: 46.5, third: 35 },

  // ── S 组（提高组） ───────────────────────────────────
  { year: 2019, group: 'S', promotion: 67.5, first: 80, second: 67, third: 51 },
  { year: 2020, group: 'S', promotion: 55.5, first: 70, second: 50, third: 43 },
  { year: 2021, group: 'S', promotion: 52, first: 60, second: 45, third: 30 },
  { year: 2022, group: 'S', promotion: 69.5, first: 64, second: 47, third: 31 },
  { year: 2023, group: 'S', promotion: 46.5, first: 55, second: 42, third: 30 },
  { year: 2024, group: 'S', promotion: 49.5, first: 58, second: 47, third: 37 },
  { year: 2025, group: 'S', promotion: 52.5, first: 66.5, second: 50.5, third: 39 },
];

/**
 * 取某一年某个组别的分数线。
 * 数据缺失时返回 null，UI 应当跳过该年的 markLine。
 */
export function getScoreLine(
  year: number,
  group: CspGroup,
): YearlyScoreLine | null {
  return (
    SCORE_LINES.find((s) => s.year === year && s.group === group) ?? null
  );
}

/**
 * 取某一年某个组别存在的所有分数线（key 数组），
 * 用于动态判断需要画几条 markLine。
 */
export const SCORE_LINE_KEYS = [
  'promotion',
  'first',
  'second',
  'third',
] as const;

export type ScoreLineKey = (typeof SCORE_LINE_KEYS)[number];

export const SCORE_LINE_META: Record<
  ScoreLineKey,
  { label: string; color: string; short: string }
> = {
  promotion: { label: '广东晋级线', color: '#dc2626', short: '晋级' },
  first: { label: '全国一等线', color: '#f59e0b', short: '一等' },
  second: { label: '全国二等线', color: '#3b82f6', short: '二等' },
  third: { label: '全国三等线', color: '#10b981', short: '三等' },
};

/**
 * 把分数按"奖项级别"分类（用于总体诊断、AI 报告卡片）。
 *
 * 优先级（从高到低）：一等 > 二等 > 三等 > 未达三等。
 * 若 year/group 无数据，则返回 'unknown'。
 */
export type AwardBand =
  | 'first'
  | 'second'
  | 'third'
  | 'below-third'
  | 'unknown';

export function classifyAward(
  score: number,
  year: number,
  group: CspGroup,
): AwardBand {
  const line = getScoreLine(year, group);
  if (!line) return 'unknown';
  if (score >= line.first) return 'first';
  if (score >= line.second) return 'second';
  if (score >= line.third) return 'third';
  return 'below-third';
}

export const AWARD_LABEL: Record<AwardBand, string> = {
  first: '全国一等奖',
  second: '全国二等奖',
  third: '全国三等奖',
  'below-third': '未达三等线',
  unknown: '无对照数据',
};

export const AWARD_COLOR: Record<AwardBand, string> = {
  first: '#f59e0b',
  second: '#3b82f6',
  third: '#10b981',
  'below-third': '#94a3b8',
  unknown: '#cbd5e1',
};
