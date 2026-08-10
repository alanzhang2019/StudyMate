// /lib/server/csp-paper-qa.ts
//
// 单题 AI 答疑 —— 学生针对某道错题自由提问, AI 围绕该题的
// 题干 / 选项 / 正确答案 / 学生答案 / 解析 给出针对性回答。
//
// 用法：
//   POST /api/csp-quiz/qa
//   Body: {
//     classroomId: string,
//     questionId: string,
//     userQuestion: string,
//     history?: Array<{ role: 'user' | 'assistant', content: string }>,
//   }
//   Response: { success: true, answer: string }
//
// 行为：
//   1. 复用 lib/server/csp-paper-analysis.loadWrongQuestionContexts
//      拿到本卷子所有错题上下文；
//   2. 找到 questionId 对应的那道题 (必须是错题)；
//   3. 构造 system + 多轮 messages 喂给 LLM；
//   4. (user, questionId, userQuestion, history-hash) 5 分钟 LRU 缓存。
//
// 错误码：
//   401 NOT_SIGNED_IN
//   400 MISSING_FIELD        缺 classroomId / questionId / userQuestion
//   404 NOT_FOUND            找不到对应题目
//   422 NOT_WRONG_ANSWER     该题不是错题 (不能答疑)
//   502 AI_FAILED            LLM 调用失败
//   500 INTERNAL_ERROR
//
// 与整体报告 (analyze-paper) 的关系：
//   - analyze-paper 一次性出诊断报告 (薄弱知识点 / 根因 / 建议)；
//   - qa 是报告里的"逐题问 AI" 入口, 复用同样的错题上下文但
//     LLM 角色不同 (答疑老师 vs 学习诊断专家)。

import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { normalizeAiErrorMessage } from '@/lib/server/normalize-ai-error';
import {
  loadWrongQuestionContexts,
  PaperAnalysisError,
} from '@/lib/server/csp-paper-analysis';
import { createLogger } from '@/lib/logger';

const log = createLogger('PaperQA');

export class PaperQaError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'NOT_WRONG_ANSWER'
      | 'AI_FAILED'
      | 'NO_DATA' = 'AI_FAILED',
  ) {
    super(message);
  }
}

// ── 公开类型 ─────────────────────────────────────────────────────

export interface QaHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface QaRequest {
  classroomId: string;
  questionId: string;
  userQuestion: string;
  history?: QaHistoryItem[];
}

export interface QaResponse {
  answer: string;
  cached: boolean;
}

// ── In-process LRU ───────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<
  string,
  { answer: string; at: number }
>();

function cacheGet(key: string): { answer: string } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { answer: hit.answer };
}

function cachePut(key: string, answer: string) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { answer, at: Date.now() });
}

function hashKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

// ── 构造 prompt ─────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `你是一位资深的 CSP-J/S 初赛辅导老师，正在一对一回答一位做错这道真题的学生。

要求：
  - 用中文回答，口吻亲切、像在跟学生直接对话。
  - 紧扣这一道题的题干、选项、正确答案与解析回答，**不要发散到其他题**。
  - 学生问"为什么对 / 为什么我错"时，先给一句话结论，再用 1-3 句解释。
  - 学生问"如果选项 X 改成 Y 会怎样"或类似变形题时, 认真推演。
  - 涉及算法 / 代码时, 用 C++ 风格伪代码或文字步骤描述, 不要写完整的可运行程序。
  - 如果学生的问题跟这道题无关 (例如"今天天气"), 礼貌地引导回题目。
  - 回答长度：通常 80-300 字；如果学生要详细推导, 最多 500 字。
  - 不要在回答里加 markdown 标题 (#, ##) 或代码块包裹，直接出可读文本。`;
}

function buildUserPrompt(args: {
  questionText: string;
  options: Array<{ label: string; value: string; text: string }>;
  correctAnswer: string | string[];
  userAnswer: string | string[];
  analysis: string;
  sceneTitle: string;
  sceneCategory: string | null;
  points: number;
  userQuestion: string;
  history?: QaHistoryItem[];
}): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const optLines = args.options.length
    ? args.options.map((o) => `${o.label}. ${o.text}`).join('\n')
    : '(无选项 — 阅读程序题或完善程序题)';
  const userAns = Array.isArray(args.userAnswer)
    ? args.userAnswer.join(', ')
    : args.userAnswer || '未作答';
  const correctAns = Array.isArray(args.correctAnswer)
    ? args.correctAnswer.join(', ')
    : args.correctAnswer;

  // 第一轮 system 之前的事实, 作为 system 的一部分发给模型, 让模型
  // 始终记住题目上下文; 后续多轮只把 user / assistant 走 messages 流。
  const context = `【题目上下文】
试卷场景: ${args.sceneTitle} (${args.sceneCategory ?? 'unknown'}, ${args.points} 分)
题干: ${args.questionText}
选项:
${optLines}
正确答案: ${correctAns}
学生原答案: ${userAns}
原题解析: ${args.analysis || '(无)'}

现在请基于以上题目, 回答学生的提问。`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // 把历史对话前情 (history) 灌进 messages, 让 LLM 知道上下文
  if (Array.isArray(args.history) && args.history.length > 0) {
    // 限制 history 长度, 避免 token 爆炸
    const trimmed = args.history.slice(-8);
    for (const h of trimmed) {
      if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        messages.push({ role: h.role, content: h.content.slice(0, 1500) });
      }
    }
  }

  // 当前提问作为最后一条 user message, 与"上下文"拼接, 让模型
  // 在第一轮就能看到完整背景。
  messages.push({
    role: 'user',
    content: `${context}\n\n【学生提问】\n${args.userQuestion}`,
  });

  return { system: buildSystemPrompt(), messages };
}

// ── 公开入口 ────────────────────────────────────────────────────

export async function answerWrongQuestion(
  userId: string,
  req: QaRequest,
  httpReq: NextRequest,
): Promise<QaResponse> {
  if (!req.classroomId || !req.questionId || !req.userQuestion) {
    throw new PaperQaError('classroomId / questionId / userQuestion 必填', 'NOT_FOUND');
  }
  if (req.userQuestion.trim().length === 0) {
    throw new PaperQaError('问题不能为空', 'NOT_FOUND');
  }
  if (req.userQuestion.length > 600) {
    throw new PaperQaError('问题太长 (上限 600 字符)', 'NOT_FOUND');
  }

  // 拉错题上下文, 复用 analyze-paper 的数据源
  let questions: Awaited<ReturnType<typeof loadWrongQuestionContexts>>['questions'];
  try {
    const ctx = await loadWrongQuestionContexts(userId, req.classroomId);
    questions = ctx.questions;
  } catch (err) {
    if (err instanceof PaperAnalysisError) {
      throw new PaperQaError(err.message, 'NOT_FOUND');
    }
    throw err;
  }

  const target = questions.find((q) => q.id === req.questionId);
  if (!target) {
    throw new PaperQaError(
      '找不到该题, 或该题你答对了 (仅错题支持 AI 答疑)',
      'NOT_WRONG_ANSWER',
    );
  }

  // 缓存 key: user + question + 当前提问 + history 的前 8 轮签名
  const historySig = (req.history ?? [])
    .slice(-8)
    .map((h) => `${h.role}:${h.content.slice(0, 80)}`)
    .join('|');
  const cacheKey = hashKey([
    userId,
    req.classroomId,
    req.questionId,
    req.userQuestion,
    historySig,
  ]);
  const cached = cacheGet(cacheKey);
  if (cached) {
    return { answer: cached.answer, cached: true };
  }

  const resolved = await resolveModelFromHeaders(httpReq, {});
  const { system, messages } = buildUserPrompt({
    questionText: target.text,
    options: target.options,
    correctAnswer: target.correctAnswer,
    userAnswer: target.userAnswer,
    analysis: target.analysis,
    sceneTitle: target.sceneTitle,
    sceneCategory: target.sceneCategory,
    points: target.points,
    userQuestion: req.userQuestion,
    history: req.history,
  });

  log.info(
    `[qa] classroomId=${req.classroomId} questionId=${req.questionId} model=${resolved.modelString} history=${(req.history ?? []).length}`,
  );

  let result;
  try {
    result = await callLLM(
      {
        model: resolved.model,
        system,
        messages,
        maxOutputTokens: 800,
        temperature: 0.5,
      },
      'csp-paper-qa',
      { retries: 1, validate: (t) => t.trim().length > 0 },
      resolved.thinkingConfig,
    );
  } catch (error) {
    log.error('[qa] LLM call failed:', error);
    throw new PaperQaError(
      normalizeAiErrorMessage(error) || 'AI 调用失败',
      'AI_FAILED',
    );
  }

  const answer = (result.text ?? '').trim();
  if (!answer) {
    throw new PaperQaError('AI 返回为空', 'AI_FAILED');
  }

  cachePut(cacheKey, answer);
  return { answer, cached: false };
}
