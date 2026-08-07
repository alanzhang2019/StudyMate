/**
 * 三段复盘的 LLM prompt 模板 (2026-07-02).
 *
 * 选模型策略:
 *   - 第 2 段 (正解) 和 第 3 段 (变式题) 都不需要 vision, 用文本模型即可
 *   - 默认走 MISTAKE_CLASSROOM_MODEL (kimi:moonshotai/kimi-k2.5) — 已经验证
 *     在生产中能稳定处理数学文本; OCR 视觉模型 qwen3-vl-30b-a3b-instruct
 *     因为 RPM 配额紧, 不应该拿来做纯文本任务
 *   - 解析时强制要求 JSON 输出 (经 parseJsonResponse 修复, 见 lib/generation
 *     /json-repair.ts), prompt 末尾明确"只返回 JSON, 不要 Markdown 块"
 *
 * 设计参考梦熊信奥"复盘"环节:
 *   - 正解: 不是单纯公布答案, 而是要还原"赛场解题思维":
 *     看到题目条件 → 优先用哪个算法 / 方法 → 边界设定 → 易错点
 *   - 变式题: "同一知识点, 不同数字 / 不同场景", 难度相当
 */

import type { MistakeBookItem } from './api';

// ---------------------------------------------------------------------------
// 第 2 段: 错题正解
// ---------------------------------------------------------------------------

/**
 * 第 2 段: 错题正解
 * ---------------------------------------------------------------------------
 *
 * `item` 故意用宽松类型 (`Record<string, unknown>`):
 *   - 服务端调用时, db shim 返回的 Row 是 `Record<string, any>`, 字段值
 *     也是 `any`, 不能直接喂给 `Pick<MistakeBookItem, ...>` (会因为
 *     null/undefined 不匹配而 type error).
 *   - 客户端调用时, `MistakeBookItem` 也有同样的字段, 结构兼容.
 *   - prompt 内部访问字段时用 `?? null` 兜底, 不依赖具体类型.
 * 这样服务端/客户端共用同一份 prompt 构造逻辑, 不用写两份.
 */
// `item` 故意用宽松类型:
//   - 服务端 db shim 返回的 Row 是 `Record<string, any>`, 任何字段是
//     `any`, 跟 `MistakeBookItem` 的 `string | null` 不直接兼容.
//   - 客户端 `MistakeBookItem` 也有同样的字段, 结构兼容.
//   - prompt 内部访问字段时用 `??` 兜底, 不依赖具体类型.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PromptItem = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VariantPromptItem = Record<string, any>;

export interface SolutionPromptInput {
  item: PromptItem;
  /** 用户在第 1 段自述的错因 — 用来让 AI 针对性地指出"避坑点". */
  errorCause?: string | null;
  errorCauseCategory?: string | null;
}

export const SOLUTION_PROMPT_SYSTEM = `你是数学错题讲解老师, 擅长把"我做错的地方"讲清楚, 而不是只给标准答案.

你的任务是: 针对学生的一道错题, 生成**标准解题思路**, 帮学生"内化"这个题目的解法.

要求:
1. 先用 1-2 句话**复述**题目 (用自己的话), 确认你理解对了.
2. 完整还原**赛场解题思维**, 不少于 3 步, 每步都要解释"为什么这一步" — 重点是"考场临场判断"而不是"事后复盘".
3. 给出**最终答案** (明确写出, 不要藏在文字里).
4. 单独列一个 **"易错点"** 段落 (2-3 条), 专门点出学生最容易踩的坑.
5. 如果学生在第 1 段给出了错因, 在"易错点"里**直接针对他/她的错因**写"你这次错的点属于以下哪一类, 怎么避免".

格式: 纯 Markdown 文本, 不要 JSON, 不要代码块. 长度 300-500 字.`;

/**
 * 用户 prompt — 拼装题目、学生答案、正确答案(如有)、错因信息.
 * 注意脱敏: 不暴露 visitorId 之类的内部字段.
 */
export function buildSolutionPrompt(input: SolutionPromptInput): string {
  const { item, errorCause, errorCauseCategory } = input;
  const parts: string[] = [];

  parts.push(`## 题目\n${item.problemText ?? ''}`);

  if (item.userAnswer) {
    parts.push(`## 学生原答案\n${item.userAnswer}`);
  }
  if (item.correctAnswer) {
    parts.push(`## 参考答案 (如果有)\n${item.correctAnswer}`);
  }

  if (errorCause || errorCauseCategory) {
    const label = errorCauseCategory
      ? categoryLabel(errorCauseCategory)
      : '未分类';
    parts.push(`## 学生的自述错因\n分类: ${label}\n描述: ${errorCause ?? '(未填写)'}`);
  }

  parts.push(`## 学科 / 年级\n${item.subject ?? 'math'} / ${item.grade ?? '未知'}`);

  return parts.join('\n\n');
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'careless':
      return '粗心';
    case 'wrong_approach':
      return '思路错';
    case 'missing_knowledge':
      return '知识点漏';
    case 'other':
      return '其他';
    default:
      return category;
  }
}

// ---------------------------------------------------------------------------
// 第 3 段: 同类变式题
// ---------------------------------------------------------------------------

export interface VariantPromptInput {
  item: VariantPromptItem;
}

export const VARIANT_PROMPT_SYSTEM = `你是一位数学命题老师, 任务是给学生出一道**同类变式题** — 用来巩固他/她刚做错的那道题.

变式题的设计原则 (非常重要, 决定学生是否真掌握):
1. **同一知识点**: 必须用相同的核心方法/公式/定理, 不要换考点.
2. **不同数字或场景**: 数字、人物名、场景都要换, 但**结构保持一致**.
3. **难度相当**: 不要明显变难 (学生受挫) 或变简单 (无巩固效果), 控制在 ±10% 难度.
4. **不要原题**: 不准照搬原题, 哪怕换 1-2 个数字也算变式.
5. **能严格判分**: 答案必须是**唯一的** (数字 / 表达式 / 单词), 不要开放式.

输出格式要求 (必须严格遵守, 否则前端无法解析):
- 必须是 **纯 JSON**, 没有任何 Markdown 标记, 没有 \`\`\`json 包裹.
- 字段:
  - "question": 字符串, 变式题完整题目
  - "answer": 字符串, 变式题标准答案 (简短, 便于比对)
  - "reasoning": 字符串, 1-2 句话解释为什么这题和原题"同型" (这个字段给前端展示用, 不参与判分)

直接输出 JSON, 不要任何前缀/后缀文字.`;

export function buildVariantPrompt(input: VariantPromptInput): string {
  const { item } = input;
  const parts: string[] = [];

  parts.push(`## 原题\n${item.problemText}`);
  if (item.correctAnswer) {
    parts.push(`## 原题答案\n${item.correctAnswer}`);
  }
  parts.push(`## 学科 / 年级\n${item.subject ?? 'math'} / ${item.grade ?? '未知'}`);

  parts.push(
    `\n## 任务\n请出 1 道同型变式题. 严格按 system prompt 的 JSON 格式输出.`,
  );

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// 变式题判分 prompt
// ---------------------------------------------------------------------------

export const VARIANT_CHECK_PROMPT_SYSTEM = `你是一位数学老师, 任务是**判分**: 判断学生提交的答案是否和标准答案等价.

判分原则:
1. **数值题**: 允许等价的表达方式 (例如 0.5 = 1/2 = 50%), 数字完全一致就满分.
2. **表达式题**: 等价变形算对 (例如 (a+b)^2 = a^2 + 2ab + b^2).
3. **应用题**: 最终数值对就行, 过程不评分.
4. **明确错误**: 数字错、符号错、方法错 → 0 分; 缺单位、格式不同但数值对 → 1 分.

输出格式: 严格 JSON, 不要 Markdown 标记:
{
  "correct": true | false,
  "feedback": "给学生的反馈, 1-2 句话, 错的时候指出错在哪"
}`;

export interface VariantCheckInput {
  question: string;
  correctAnswer: string;
  userAnswer: string;
}

export function buildVariantCheckPrompt(input: VariantCheckInput): string {
  return [
    `## 变式题\n${input.question}`,
    `## 标准答案\n${input.correctAnswer}`,
    `## 学生答案\n${input.userAnswer}`,
    `\n请判分, 严格按 system prompt 的 JSON 格式输出.`,
  ].join('\n\n');
}
