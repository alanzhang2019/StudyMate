// /lib/server/csp-paper-analysis.ts
//
// 单套历年真题的 AI 分析报告生成。
//
// 调用入口：/api/csp-quiz/analyze-paper。
//
// 流程：
//   1. 读 csp_quiz_submissions 拿到本卷子 (user, classroom) 的所有
//      scene 提交，按 submittedAt DESC 选最新一次 (latest-wins
//      与 finalize-classroom 保持一致)；
//   2. 解析每条 answersJson 抽 wrong list，每题带题干/选项/用户
//      答案/正确答案/解析 (从 classroom JSON 里读)；
//   3. 把错题列表 + 知识点分类法塞进 system + user prompt，调
//      callLLM 走 JSON 模式 (response_format json_object) 拿结构化
//      输出；
//   4. 解析 JSON，做 schema 校验 (weakKnowledgePoints / rootCauses /
//      nextSteps 三板块)；
//   5. 加一层 in-process LRU 缓存：key = hash(classroomId +
//      sorted(wrongQuestionIds))。同一份错题 5 分钟内复用上次结果，
//      避免学生反复点"重新分析"把 token 烧光。
//
// 失败兜底：AI 拒绝、超时、JSON parse 失败 → 抛 PaperAnalysisError，
// 路由层捕获后返回 500 + 中文提示，前端降级显示重试按钮。

import { createHash } from 'crypto';
import { callLLM } from '@/lib/ai/llm';
import { db } from '@/lib/db';
import { readClassroom } from '@/lib/server/classroom-storage';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import type { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { normalizeAiErrorMessage } from '@/lib/server/normalize-ai-error';

const log = createLogger('PaperAnalysis');

// ── 公开类型 ─────────────────────────────────────────────────────

export type SeverityLevel = 'low' | 'medium' | 'high';

export type RootCauseType =
  | 'concept-confusion' // 概念混淆
  | 'blind-spot'        // 知识点盲区
  | 'calculation'       // 计算错误
  | 'reading'           // 阅读/审题不清
  | 'edge-case'         // 边界条件遗漏
  | 'logic'             // 逻辑推理错误
  | 'memory';           // 记忆/背诵遗漏

export type Priority = 1 | 2 | 3;

export interface WeakKnowledgePoint {
  topic: string;          // 例如 "进制转换"
  wrongCount: number;     // 本卷子答错几道
  totalCount: number;     // 本卷子该知识点总题数
  accuracy: number;       // 0-100
  severity: SeverityLevel;
  relatedQuestionIds: string[];
}

export interface RootCause {
  type: RootCauseType;
  label: string;          // 例如 "概念混淆"
  description: string;    // AI 给的具体描述
  affectedQuestionIds: string[];
}

export interface NextStep {
  priority: Priority;     // 1 = 最优先
  action: string;         // 建议学生做的事
  rationale: string;      // 为什么要做这件事 (基于本次错题)
}

export interface PaperAnalysisReport {
  overallDiagnosis: string;        // 一句话总诊断
  weakKnowledgePoints: WeakKnowledgePoint[];
  rootCauses: RootCause[];
  nextSteps: NextStep[];
  // 元信息
  meta: {
    classroomId: string;
    title: string;
    group: 'J' | 'S';
    year: number;
    wrongCount: number;
    totalCount: number;
    score: number;
    generatedAt: string;  // ISO
    cached: boolean;
  };
}

export class PaperAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_DATA'
      | 'AI_FAILED'
      | 'AI_PARSE_FAILED'
      | 'NOT_FOUND' = 'AI_FAILED',
  ) {
    super(message);
  }
}

// ── CSP-J 知识点分类法（system prompt 注入） ────────────────────

const KNOWLEDGE_TAXONOMY = `
CSP-J/S 初赛常见知识点分类（请优先从此表里挑选 topic 标签）：

【计算机基础】
  - 进制与编码 (二进制/八进制/十六进制转换, ASCII / Unicode)
  - 原码/反码/补码 (有符号数表示)
  - 冯诺依曼结构 / 计算机历史
  - 数据表示单位 (bit/byte/KB/MB)
  - 信息论基础 (信息量, 熵)

【数据结构】
  - 数组 / 字符串
  - 链表 (单向/双向/循环)
  - 栈 / 队列 / 双端队列
  - 树 (二叉树/二叉搜索树/堆/并查集/线段树)
  - 图 (存储方式/遍历/最短路)
  - 哈希表

【算法】
  - 排序 (冒泡/选择/插入/快排/归并/堆排)
  - 搜索 (二分查找/DFS/BFS)
  - 动态规划
  - 贪心
  - 分治
  - 递归 / 回溯
  - 复杂度分析 (时间/空间)

【数学】
  - 数论 (质数/最大公约数/模运算)
  - 组合数学 (排列/组合/二项式定理)
  - 概率基础
  - 矩阵
  - 几何基础
  - 数学归纳法

【编程语言基础】
  - C++ 语法 (变量/类型/运算符/控制流)
  - 函数与参数传递
  - 数组与指针
  - 结构体
  - 文件 I/O

【程序阅读与分析】
  - 状态追踪
  - 循环不变式
  - 递归调用栈
  - 指针追踪

【完善程序】
  - 算法实现
  - 边界条件处理
  - 代码填空逻辑
`;

// ── In-process LRU (Map + TTL) ──────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { report: PaperAnalysisReport; at: number }>();

function cacheGet(key: string): PaperAnalysisReport | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.report;
}

function cachePut(key: string, report: PaperAnalysisReport) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // 简单 FIFO 驱逐，避免内存无限增长
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { report, at: Date.now() });
}

function hashKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

// ── 错题聚合 ─────────────────────────────────────────────────────

type AnswerEntry = {
  questionId?: string;
  choice?: string | string[];
  correct?: boolean;
  points?: number;
};

type QuestionContext = {
  id: string;
  sceneId: string;
  sceneTitle: string;
  sceneCategory: 'choice' | 'read' | 'perfect' | null;
  text: string;
  options: Array<{ label: string; value: string; text: string }>;
  correctAnswer: string | string[];
  analysis: string;
  userAnswer: string | string[];
  points: number;
  topicHint?: string; // AI 答题分析里偶尔会带的 topic 字段
};

async function buildWrongQuestionContexts(
  userId: string,
  classroomId: string,
): Promise<{
  questions: QuestionContext[];
  totalCount: number;
  score: number;
  title: string;
  group: 'J' | 'S';
  year: number;
}> {
  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    throw new PaperAnalysisError('Classroom not found', 'NOT_FOUND');
  }

  // 解析 meta
  const idMatch = classroomId.match(/^cm_imp_csp([js])(\d{4})[js]_v1$/);
  if (!idMatch) {
    throw new PaperAnalysisError('非历年真题卷', 'NOT_FOUND');
  }
  const group: 'J' | 'S' = idMatch[1] === 'j' ? 'J' : 'S';
  const year = parseInt(idMatch[2], 10);
  const title = classroom.stage?.name ?? classroomId;

  // sceneId -> { category, questions[] } 索引
  const sceneIndex = new Map<
    string,
    {
      title: string;
      category: 'choice' | 'read' | 'perfect' | null;
      questions: Map<
        string,
        {
          text: string;
          options: Array<{ label: string; value: string; text: string }>;
          correctAnswer: string | string[];
          analysis: string;
          points: number;
          topicHint?: string;
        }
      >;
    }
  >();
  for (const scene of classroom.scenes ?? []) {
    if (!scene?.id) continue;
    const content = (scene as any).content;
    if (!content || !Array.isArray(content.questions)) continue;
    const qMap = new Map<
      string,
      {
        text: string;
        options: Array<{ label: string; value: string; text: string }>;
        correctAnswer: string | string[];
        analysis: string;
        points: number;
        topicHint?: string;
      }
    >();
    for (const q of content.questions) {
      if (!q?.id) continue;
      qMap.set(q.id, {
        text: String(q.text ?? '').slice(0, 500), // 限长，避免 prompt 爆炸
        options: Array.isArray(q.options)
          ? q.options.map((o: any) => ({
              label: String(o.label ?? ''),
              value: String(o.value ?? ''),
              text: String(o.text ?? '').slice(0, 200),
            }))
          : [],
        correctAnswer: (q.correctAnswer ?? q.answer ?? '') as string | string[],
        analysis: String(q.analysis ?? '').slice(0, 400),
        points: typeof q.points === 'number' ? q.points : 1,
        topicHint: typeof q.topic === 'string' ? q.topic : undefined,
      });
    }
    sceneIndex.set(scene.id, {
      title: String(scene.title ?? ''),
      category: ((scene as any).category ?? null) as
        | 'choice'
        | 'read'
        | 'perfect'
        | null,
      questions: qMap,
    });
  }

  // 取本卷子 (user, classroom) 所有 scene 的最新一条 (latest-wins)
  const rows = db.cspQuizSubmission.findByUser(userId, classroomId);
  const latestByScene = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!latestByScene.has(r.sceneId)) {
      // findByUser 已按 submittedAt DESC 排序，第一次见到即为最新
      latestByScene.set(r.sceneId, r);
    }
  }

  const questions: QuestionContext[] = [];
  let totalCount = 0;
  let totalCorrect = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  for (const [, row] of latestByScene) {
    const sceneInfo = sceneIndex.get(row.sceneId);
    if (!sceneInfo) continue;
    let entries: AnswerEntry[] = [];
    try {
      const parsed = JSON.parse(row.answersJson ?? '[]');
      if (Array.isArray(parsed)) entries = parsed as AnswerEntry[];
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.questionId) continue;
      const qCtx = sceneInfo.questions.get(e.questionId);
      if (!qCtx) continue;
      totalCount += 1;
      totalPoints += qCtx.points;
      if (e.correct === true) {
        totalCorrect += 1;
        earnedPoints += qCtx.points;
        continue;
      }
      // wrong 收录
      questions.push({
        id: e.questionId,
        sceneId: row.sceneId,
        sceneTitle: sceneInfo.title,
        sceneCategory: sceneInfo.category,
        text: qCtx.text,
        options: qCtx.options,
        correctAnswer: qCtx.correctAnswer,
        analysis: qCtx.analysis,
        userAnswer: (e.choice ?? '') as string | string[],
        points: qCtx.points,
        topicHint: qCtx.topicHint,
      });
    }
  }
  const score =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;

  return { questions, totalCount, score, title, group, year };
}

// ── 构造 prompt ─────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `你是一位资深的 CSP-J/S 初赛学习诊断专家，正在帮一位学生分析他刚做完的某套历年真题。

你的任务是基于学生的错题列表，从三个角度出具结构化分析：
  1. 薄弱知识点：把错题按知识点归类，给出每个知识点的错误率与严重度。
  2. 根因分析：把错题按错误原因归类（概念混淆 / 知识点盲区 / 计算错误 / 阅读/审题不清 / 边界条件遗漏 / 逻辑推理错误 / 记忆遗漏），描述具体表现。
  3. 下一步学习建议：基于上面两点给出 3-5 条具体可执行的下一步动作（要包含"复习哪个精讲课件的第几章"或"专项练习 X 类题型"等具体指引）。

输出要求：
  - 必须以 **严格的 JSON 对象** 形式输出，不要任何 markdown 代码块包裹，不要任何额外说明文字。
  - JSON 顶层 schema 必须是：
    {
      "overallDiagnosis": string,                 // 一句话总诊断
      "weakKnowledgePoints": [                    // 数组，按错误数从多到少排序
        {
          "topic": string,                         // 知识点名称（从下面分类法选）
          "wrongCount": number,                    // 错题数
          "totalCount": number,                    // 该知识点总题数
          "accuracy": number,                      // 0-100，保留整数
          "severity": "low" | "medium" | "high",  // 严重度
          "relatedQuestionIds": string[]           // 错题 id 列表
        }
      ],
      "rootCauses": [
        {
          "type": "concept-confusion" | "blind-spot" | "calculation" | "reading" | "edge-case" | "logic" | "memory",
          "label": string,                          // 中文短标签
          "description": string,                    // 2-3 句具体描述，引用错题
          "affectedQuestionIds": string[]
        }
      ],
      "nextSteps": [
        {
          "priority": 1 | 2 | 3,                    // 1 = 最优先
          "action": string,                         // 具体动作
          "rationale": string                       // 为什么，引用本次错题
        }
      ]
    }
  - 所有 relatedQuestionIds / affectedQuestionIds 都必须是用户提供的错题 id 中真实存在的字符串，禁止编造。
  - knowledge points 限 3-6 个，根因限 2-4 个，nextSteps 限 3-5 个。
  - 严禁在 JSON 之外输出任何字符（包括 "以下是分析" 这种引导语）。

${KNOWLEDGE_TAXONOMY}`;
}

function buildUserPrompt(input: {
  title: string;
  group: 'J' | 'S';
  year: number;
  score: number;
  totalCount: number;
  wrongCount: number;
  questions: QuestionContext[];
}): string {
  const wrongLines = input.questions.map((q, i) => {
    const opts = q.options
      .map((o) => `${o.label}. ${o.text}`)
      .join(' | ');
    const userAns = Array.isArray(q.userAnswer)
      ? q.userAnswer.join(',')
      : q.userAnswer || '未作答';
    const correctAns = Array.isArray(q.correctAnswer)
      ? q.correctAnswer.join(',')
      : q.correctAnswer;
    return `【错题 ${i + 1}】 id=${q.id}
题型: ${q.sceneCategory ?? 'unknown'} | 场景: ${q.sceneTitle} | 分值: ${q.points}
题干: ${q.text}
选项: ${opts}
学生答案: ${userAns}
正确答案: ${correctAns}
解析: ${q.analysis || '(无)'}${q.topicHint ? `\n知识点提示: ${q.topicHint}` : ''}`;
  });

  return `试卷: ${input.year} 年 ${input.group} 组 CSP 真题卷「${input.title}」
总分: ${input.score} 分 (答对 ${input.totalCount - input.wrongCount}/${input.totalCount} 题)
错题数: ${input.wrongCount}

${wrongLines.join('\n\n')}

请按 system prompt 中规定的 JSON schema 输出分析报告。`;
}

// ── JSON 解析 + 校验 ────────────────────────────────────────────

function tryParseReport(raw: string, knownIds: Set<string>): PaperAnalysisReport {
  // 先剥 markdown ```json ... ``` 包裹（部分模型会自己加）
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    throw new PaperAnalysisError('AI 返回的 JSON 解析失败', 'AI_PARSE_FAILED');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new PaperAnalysisError('AI 返回不是对象', 'AI_PARSE_FAILED');
  }

  const overallDiagnosis = String(parsed.overallDiagnosis ?? '').trim().slice(0, 400);
  if (!overallDiagnosis) {
    throw new PaperAnalysisError('AI 缺少 overallDiagnosis 字段', 'AI_PARSE_FAILED');
  }

  const validSeverities: SeverityLevel[] = ['low', 'medium', 'high'];
  const weakKnowledgePoints: WeakKnowledgePoint[] = Array.isArray(
    parsed.weakKnowledgePoints,
  )
    ? parsed.weakKnowledgePoints
        .filter((it: any) => it && typeof it.topic === 'string')
        .map((it: any) => ({
          topic: String(it.topic).slice(0, 40),
          wrongCount: Math.max(0, parseInt(String(it.wrongCount ?? 0), 10) || 0),
          totalCount: Math.max(0, parseInt(String(it.totalCount ?? 0), 10) || 0),
          accuracy: Math.max(0, Math.min(100, parseInt(String(it.accuracy ?? 0), 10) || 0)),
          severity: validSeverities.includes(it.severity) ? it.severity : 'medium',
          relatedQuestionIds: Array.isArray(it.relatedQuestionIds)
            ? it.relatedQuestionIds
                .map((x: any) => String(x))
                .filter((x: string) => knownIds.has(x))
            : [],
        }))
        .sort((a: WeakKnowledgePoint, b: WeakKnowledgePoint) => b.wrongCount - a.wrongCount)
        .slice(0, 6)
    : [];

  const validRootTypes: RootCauseType[] = [
    'concept-confusion',
    'blind-spot',
    'calculation',
    'reading',
    'edge-case',
    'logic',
    'memory',
  ];
  const rootCauses: RootCause[] = Array.isArray(parsed.rootCauses)
    ? parsed.rootCauses
        .filter((it: any) => it && validRootTypes.includes(it.type))
        .map((it: any) => ({
          type: it.type as RootCauseType,
          label: String(it.label ?? '').slice(0, 30) || '其他',
          description: String(it.description ?? '').slice(0, 300),
          affectedQuestionIds: Array.isArray(it.affectedQuestionIds)
            ? it.affectedQuestionIds
                .map((x: any) => String(x))
                .filter((x: string) => knownIds.has(x))
            : [],
        }))
        .slice(0, 4)
    : [];

  const nextSteps: NextStep[] = Array.isArray(parsed.nextSteps)
    ? parsed.nextSteps
        .filter((it: any) => it && typeof it.action === 'string')
        .map((it: any) => {
          const p = parseInt(String(it.priority ?? 2), 10);
          return {
            priority: (p === 1 || p === 2 || p === 3 ? p : 2) as Priority,
            action: String(it.action).slice(0, 200),
            rationale: String(it.rationale ?? '').slice(0, 200),
          };
        })
        .sort((a: NextStep, b: NextStep) => a.priority - b.priority)
        .slice(0, 5)
    : [];

  return {
    overallDiagnosis,
    weakKnowledgePoints,
    rootCauses,
    nextSteps,
    meta: {
      // meta 字段在调用方补全
      classroomId: '',
      title: '',
      group: 'J',
      year: 0,
      wrongCount: 0,
      totalCount: 0,
      score: 0,
      generatedAt: new Date().toISOString(),
      cached: false,
    },
  };
}

// ── 公开入口 ────────────────────────────────────────────────────

export async function generatePaperAnalysis(
  userId: string,
  classroomId: string,
  req: NextRequest,
  options: { forceRefresh?: boolean } = {},
): Promise<PaperAnalysisReport> {
  const { questions, totalCount, score, title, group, year } =
    await buildWrongQuestionContexts(userId, classroomId);

  if (questions.length === 0) {
    throw new PaperAnalysisError(
      '本卷子没有错题，暂无需要分析的内容',
      'NO_DATA',
    );
  }

  const knownIds = new Set(questions.map((q) => q.id));
  const cacheKey = hashKey([
    classroomId,
    userId,
    ...questions.map((q) => q.id).sort(),
  ]);

  if (!options.forceRefresh) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: { ...cached.meta, cached: true },
      };
    }
  }

  const resolved = await resolveModelFromHeaders(req, {});
  // 教学诊断对模型推理能力有要求，但单卷错题数一般在 5-20 道，
  // 不需要顶级旗舰模型 —— 服务端默认模型即可（gpt-5.4-mini 或
  // 用户在管理后台配置的教学模型）。我们走结构化输出模式：
  //   - 把 schema 用自然语言写进 system prompt (无需 response_format，
  //     跨 provider 通用)
  //   - prompt 控制在 6K token 以内，maxOutputTokens 留 2K
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    title,
    group,
    year,
    score,
    totalCount,
    wrongCount: questions.length,
    questions,
  });

  log.info(
    `[analyze-paper] classroomId=${classroomId} wrong=${questions.length} model=${resolved.modelString}`,
  );

  let result;
  try {
    result = await callLLM(
      {
        model: resolved.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2500,
        temperature: 0.4,
      },
      'csp-paper-analysis',
      { retries: 1, validate: (t) => t.includes('overallDiagnosis') },
      resolved.thinkingConfig,
    );
  } catch (error) {
    log.error('[analyze-paper] LLM call failed:', error);
    throw new PaperAnalysisError(
      normalizeAiErrorMessage(error) || 'AI 调用失败',
      'AI_FAILED',
    );
  }

  const raw = result.text ?? '';
  if (!raw.trim()) {
    throw new PaperAnalysisError('AI 返回为空', 'AI_PARSE_FAILED');
  }
  const parsed = tryParseReport(raw, knownIds);
  const report: PaperAnalysisReport = {
    ...parsed,
    meta: {
      classroomId,
      title,
      group,
      year,
      wrongCount: questions.length,
      totalCount,
      score,
      generatedAt: new Date().toISOString(),
      cached: false,
    },
  };
  cachePut(cacheKey, report);
  return report;
}
