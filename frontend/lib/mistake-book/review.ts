/**
 * 错题三段复盘状态机 (2026-07-02 改造).
 *
 * 阶段定义:
 *   0 - 'not_started'       错题刚加入, 还没开始复盘
 *   1 - 'cause_recorded'    已记录错因 (第 1 段)
 *   2 - 'solution_ready'    AI 正解已生成 (第 2 段)
 *   3 - 'variant_ready'     变式题已生成 (第 3 段出题)
 *   4 - 'variant_attempted' 变式题已作答, 但还没判对错
 *   5 - 'mastered'          变式题答对, 三段完成
 *
 * 设计要点:
 *   - 阶段是**派生**的, 不存到 DB 列里, 避免和"是否掌握"双重事实.
 *     这样改 review 状态不会和 isResolved 状态打架.
 *   - "掌握" (isResolved=1) 和 "三段完成" (reviewedAt set) 是两个独立
 *     维度. reviewedAt 是"我完成了标准流程"的强信号;
 *     isResolved 是"我自评掌握"的人工标记. 默认 toggle-resolved 流程
 *     会要求先 reviewedAt set, 否则拒绝标记 (见 /api/mistake-book/[id]
 *     /toggle-resolved 的 guard).
 *   - 阶段计算纯函数, 可以在 server / client 复用.
 */

export type ReviewStage =
  | 'not_started'
  | 'cause_recorded'
  | 'solution_ready'
  | 'variant_ready'
  | 'variant_attempted'
  | 'mastered';

export type ReviewStageNumber = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 复盘相关的所有列 — Row (db shim) 和 MistakeBookItem (前端 interface)
 * 都满足这个最小结构. 避免 db 返回 Row 后传给 computeReviewStage 时报
 * "missing properties" 错误.
 */
export type ReviewFields = {
  errorCause?: string | null;
  errorCauseCategory?: string | null;
  correctSolution?: string | null;
  correctSolutionAt?: string | null;
  variantQuestion?: string | null;
  variantAnswer?: string | null;
  variantUserAnswer?: string | null;
  variantResult?: 0 | 1 | null;
  reviewedAt?: string | null;
};

export const REVIEW_STAGE_LABELS: Record<ReviewStage, string> = {
  not_started: '未复盘',
  cause_recorded: '已记错因',
  solution_ready: '已看正解',
  variant_ready: '已出变式',
  variant_attempted: '变式待判',
  mastered: '已掌握',
};

export const REVIEW_STAGE_SHORT: Record<ReviewStage, string> = {
  not_started: '未复盘',
  cause_recorded: '1/3',
  solution_ready: '2/3',
  variant_ready: '3/3',
  variant_attempted: '3/3 待判',
  mastered: '完成',
};

/** 错因分类 (4 类, 来自梦熊错因拆解: 粗心 / 思路错 / 知识点漏 / 其他). */
export const ERROR_CAUSE_CATEGORIES = [
  { value: 'careless', label: '粗心 (计算 / 抄错 / 看错)' },
  { value: 'wrong_approach', label: '思路错 (方法选错 / 步骤错)' },
  { value: 'missing_knowledge', label: '知识点漏 (公式 / 定理没掌握)' },
  { value: 'other', label: '其他' },
] as const;

export type ErrorCauseCategory =
  (typeof ERROR_CAUSE_CATEGORIES)[number]['value'];

/**
 * 派生复盘阶段 — 见顶部状态机说明.
 *
 * 注意: 不依赖 `isResolved`. 阶段是"完成了几段流程"的客观进度,
 * `isResolved` 是"是否标记掌握"的人工开关, 两者解耦.
 */
export function computeReviewStage(item: ReviewFields): ReviewStage {
  if (item.reviewedAt) return 'mastered';
  if (item.variantUserAnswer && item.variantResult === null) {
    // 已提交变式答案, 但服务端还没判分 (极端情况: 判分请求失败)
    return 'variant_attempted';
  }
  if (item.variantQuestion) return 'variant_ready';
  if (item.correctSolution) return 'solution_ready';
  if (item.errorCause || item.errorCauseCategory) return 'cause_recorded';
  return 'not_started';
}

/** 复盘是否"完成" — 三段流程都走完, 且变式题答对. */
export function isReviewComplete(item: ReviewFields): boolean {
  return computeReviewStage(item) === 'mastered';
}

/**
 * 能否标记"已掌握" — 必须是 `isReviewComplete`.
 *
 * 防止用户绕过三段流程直接 toggle (这正是梦熊体系里"复盘不完整
 * = 这次刷题不算数"的硬性约束). toggle-resolved API 应当走这个
 * 守卫, 客户端 toggle 按钮 disabled 状态也走这个.
 */
export function canMarkMastered(item: ReviewFields): boolean {
  return isReviewComplete(item);
}

/** UI 进度条: 0~3, 3 表示三段都完成. */
export function reviewProgressSteps(
  stage: ReviewStage,
): { done: number; total: number } {
  switch (stage) {
    case 'not_started':
      return { done: 0, total: 3 };
    case 'cause_recorded':
      return { done: 1, total: 3 };
    case 'solution_ready':
      return { done: 2, total: 3 };
    case 'variant_ready':
    case 'variant_attempted':
      return { done: 3, total: 3 };
    case 'mastered':
      return { done: 3, total: 3 };
  }
}
