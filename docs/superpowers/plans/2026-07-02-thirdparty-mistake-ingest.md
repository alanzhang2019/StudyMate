# Third-Party Mistake Ingest + C++ Subject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose two public REST endpoints that let third-party projects (e.g. Vjudge-AI-report) submit a C++ competitive-programming problem and trigger the same courseware generation flow as native users, plus extend the domain types to support `subject: 'cpp'`.

**Architecture:** Reuse the existing mistake session + generation-preview pipeline. Add a thin `integrations` module that owns the public surface (schemas, rate limit, store, runner). Extend the subject axis at the domain / diagnose / taxonomy / openmaic boundary with adapter dispatch, keeping the math path's behavior unchanged.

**Tech Stack:** Next.js App Router, TypeScript, vitest (existing), zod, better-sqlite3 (existing via `lib/db.ts`), nanoid.

**Spec:** `docs/superpowers/specs/2026-07-02-thirdparty-mistake-ingest-design.md`

---

## File Structure

新增：

```
frontend/lib/integrations/
  schemas.ts                  # zod schema for create job, request types
  rate-limit.ts               # 内存滑动窗口限流
  store.ts                    # integration_jobs CRUD
  runner.ts                   # 后台 runIntegrationJob(jobId)
  errors.ts                   # RateLimitedError 等

frontend/lib/mistake/taxonomy/
  math-taxonomy.ts            # 原 mistake-taxonomy.ts 改名（内容不变）
  cpp-taxonomy.ts             # 新
  index.ts                    # 统一导出 getMistakeLabel

frontend/lib/mistake/diagnosis/
  diagnose-math.ts            # 原 diagnose.ts 拆出
  diagnose-cpp.ts             # 新
  index.ts                    # dispatch by subject

frontend/lib/mistake/explain/
  math-explain.ts             # 原 explain.ts 拆出
  cpp-explain.ts              # 新
  index.ts                    # dispatch by subject

frontend/lib/mistake/practice/
  math-practice.ts            # 原 generate-practice.ts 拆出
  cpp-practice.ts             # 新
  index.ts                    # dispatch by subject

frontend/app/api/integrations/
  mistake/route.ts
  jobs/[id]/route.ts
  jobs/[id]/retry/route.ts
  health/route.ts

frontend/app/api/integrations/mistake/route.test.ts
frontend/app/api/integrations/jobs/[id]/route.test.ts
frontend/app/api/integrations/health/route.test.ts
frontend/lib/integrations/schemas.test.ts
frontend/lib/integrations/rate-limit.test.ts
frontend/lib/mistake/diagnosis/diagnose-cpp.test.ts
frontend/lib/mistake/taxonomy/cpp-taxonomy.test.ts
```

修改：

```
frontend/lib/mistake/domain/types.ts                # +Subject, +CppMistakeCode, +verdict, +problemType
frontend/lib/mistake/session/types.ts               # +subject, +source='integration'
frontend/lib/db.ts                                  # +integration_jobs 表
frontend/app/api/mistake/session/route.ts           # subject union
frontend/app/api/mistake/session/analyze/route.ts   # subject union
frontend/lib/mistake/openmaic/types.ts              # MistakeClassroomInput.subject 扩
frontend/lib/mistake/openmaic/build-requirement.ts  # subject branch
frontend/app/generation-preview/page.tsx            # 选 prompt 模板
```

---

## Task 1: 领域类型扩展

**Files:**
- Modify: `frontend/lib/mistake/domain/types.ts`

- [ ] **Step 1: 修改 types.ts**

把 `ProblemInput.subject` 从字面量 `'math'` 扩为 `Subject`；新增 `InputSource = 'photo' | 'manual' | 'integration'`、`MathMistakeCode`、`CppMistakeCode`、`Subject`、`CppVerdict`、`CppProblemType` 等。

完整代码：

```ts
export type InputSource = "photo" | "manual" | "integration";

export type Subject = "math" | "cpp";

export type MathMistakeCode =
  | "carry_mistake"
  | "borrow_mistake"
  | "operator_confusion"
  | "bracket_order_error"
  | "unit_conversion_error"
  | "concept_gap";

export type CppMistakeCode =
  | "compile_error"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_format"
  | "concept_gap";

export type MistakeCode = MathMistakeCode | CppMistakeCode;

export type CppVerdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "MLE" | "PE";

export type CppProblemType =
  | "dp"
  | "greedy"
  | "brute"
  | "graph"
  | "string"
  | "math"
  | "other";

export interface ProblemInput {
  grade: number;
  subject: Subject;
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  // cpp 扩展字段（subject=cpp 时使用）
  verdict?: CppVerdict;
  problemType?: CppProblemType;
  title?: string;
}

// 保持 DiagnosisResult / AnalyzeSessionResponse / PracticeSuggestion / ParentSummary 不变
export interface MistakeLabel { code: MistakeCode; name: string; description: string; triggers: string[] }
export interface PracticeSuggestion { prompt: string; answer: string }
export interface ParentSummary { headline: string; nextStep: string }
export interface DiagnosisResult {
  normalizedProblemText: string;
  guessedMistake: MistakeCode;
  confidence: number;
  explanationForChild: string;
  knowledgePoint: string;
  practiceSuggestions: PracticeSuggestion[];
  parentSummary: ParentSummary;
}
export interface AnalyzeSessionResponse { input: ProblemInput; diagnosis: DiagnosisResult }
```

- [ ] **Step 2: tsc 通过**

```bash
cd frontend && npx tsc --noEmit
```

预期：仅可能因下游消费 `subject: 'math'` 字面量报错，不应在本文件内部错。

- [ ] **Step 3: commit**

```bash
git add frontend/lib/mistake/domain/types.ts
git commit -m "feat(domain): extend types to support subject=cpp + verdict"
```

---

## Task 2: session/openmaic 类型放宽

**Files:**
- Modify: `frontend/lib/mistake/session/types.ts`
- Modify: `frontend/lib/mistake/openmaic/types.ts`

- [ ] **Step 1: session/types.ts 扩展**

把 `MistakeSession.subject?: Subject`、`source: InputSource`、`CreateMistakeSessionInput` 同步。整段代码：

```ts
import type { ExplanationSummary } from '@/lib/mistake/ui/types';
import type { InputSource, Subject } from '@/lib/mistake/domain/types';

export type MistakeSessionStatus =
  | 'draft'
  | 'ready_to_generate'
  | 'waiting_first_scene'
  | 'live'
  | 'failed'
  | 'completed';

export interface ParentSummary {
  totalCount: number;
  solvedCount: number;
  needMoreReason: string;
  focusTopic: string;
}

export interface MistakeSession {
  id: string;
  subject?: Subject;
  studentProfileId?: string;
  source: InputSource;
  imageUrl?: string;
  ocr: {
    problemText: string;
    studentAnswer?: string;
    correctAnswerCandidate?: string;
    confidence?: number;
  };
  confirmed: {
    problemText: string;
    studentAnswer?: string;
    correctAnswer?: string;
  };
  classroomJobId?: string;
  classroomId?: string;
  explanationSummary?: ExplanationSummary;
  parentSummary?: ParentSummary;
  masteryStatus?: 'pending' | 'done';
  error?: string;
  status: MistakeSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMistakeSessionInput {
  subject?: Subject;
  studentProfileId?: string;
  source: InputSource;
  imageUrl?: string;
  ocr: MistakeSession['ocr'];
  confirmed: MistakeSession['confirmed'];
  status: MistakeSessionStatus;
}
```

- [ ] **Step 2: openmaic/types.ts 扩展**

```ts
import type { InputSource, Subject } from '@/lib/mistake/domain/types';

export interface MistakeClassroomInput {
  sessionId?: string;
  grade: number;
  subject: Subject;
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  studentName?: string;
  teachingStyle?: string;
}
```

- [ ] **Step 3: tsc 通过**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: commit**

```bash
git add frontend/lib/mistake/session/types.ts frontend/lib/mistake/openmaic/types.ts
git commit -m "feat(types): relax session + openmaic subject union to include cpp"
```

---

## Task 3: DB schema 增量

**Files:**
- Modify: `frontend/lib/db.ts`（在 `_db.exec` 块追加 CREATE TABLE 与索引；保持幂等）

- [ ] **Step 1: 在 `_db.exec` 模板字符串中、`CREATE TABLE IF NOT EXISTS parent_ai_insights` 之后追加**

```sql
  -- integration_jobs: third-party integrations (e.g. Vjudge-AI-report).
  -- Each row represents one externally-submitted problem. We kick off
  -- an in-process job that prepares a mistake session, then let the
  -- browser load /generation-preview to drive the LLM + media pipeline.
  CREATE TABLE IF NOT EXISTS integration_jobs (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    source TEXT,
    request_payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT,
    session_id TEXT,
    classroom_id TEXT,
    error_code TEXT,
    error_message TEXT,
    ip TEXT,
    ua TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_ip_time
    ON integration_jobs (ip, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_status
    ON integration_jobs (status, created_at DESC);
```

注意：保留原文件其它部分，只插入这一段。

- [ ] **Step 2: 启动 dev server 验证建表**

```bash
cd frontend && pnpm dev
```

打开 `http://localhost:3000/api/health`，应 200。然后用 curl 触发一次：

```bash
curl -X POST http://localhost:3000/api/integrations/mistake -H "Content-Type: application/json" -d '{}'
```

预期：400（虽然路由还没建，但说明能解析 JSON）。如果建表失败会在这个阶段报 SQL 错误。

- [ ] **Step 3: commit**

```bash
git add frontend/lib/db.ts
git commit -m "feat(db): add integration_jobs table for third-party ingest"
```

---

## Task 4: taxonomy 拆分

**Files:**
- Rename: `frontend/lib/mistake/taxonomy/mistake-taxonomy.ts` → `frontend/lib/mistake/taxonomy/math-taxonomy.ts`
- Create: `frontend/lib/mistake/taxonomy/cpp-taxonomy.ts`
- Create: `frontend/lib/mistake/taxonomy/index.ts`
- Create: `frontend/lib/mistake/taxonomy/cpp-taxonomy.test.ts`

- [ ] **Step 1: 重命名 math-taxonomy.ts**

```bash
git mv frontend/lib/mistake/taxonomy/mistake-taxonomy.ts frontend/lib/mistake/taxonomy/math-taxonomy.ts
```

并把 `MistakeLabel` 改为只属于本文件：

```ts
import type { MathMistakeCode } from '@/lib/mistake/domain/types';

export type MistakeLabel = {
  name: string;
  description: string;
  triggers: string[];
};

export const mathMistakeTaxonomy: Record<MathMistakeCode, MistakeLabel> = {
  carry_mistake: { name: '进位错误', description: '...', triggers: [...] },
  borrow_mistake: { name: '退位错误', description: '...', triggers: [...] },
  operator_confusion: { name: '运算符混淆', description: '...', triggers: [...] },
  bracket_order_error: { name: '括号顺序错误', description: '...', triggers: [...] },
  unit_conversion_error: { name: '单位换算错误', description: '...', triggers: [...] },
  concept_gap: { name: '概念理解不足', description: '...', triggers: [...] },
};
```

`triggers` 数组内容从原文件照搬。

- [ ] **Step 2: cpp-taxonomy.ts**

```ts
import type { CppMistakeCode } from '@/lib/mistake/domain/types';
import type { MistakeLabel } from './math-taxonomy';

export const cppMistakeTaxonomy: Record<CppMistakeCode, MistakeLabel> = {
  compile_error: {
    name: '编译错误',
    description: 'C++ 代码无法通过编译（CE）。',
    triggers: ['语法错', '缺分号', '未声明变量', '头文件缺失'],
  },
  wrong_answer: {
    name: '答案错误',
    description: '代码能跑但结果不对（WA）。',
    triggers: ['思路错', '边界遗漏', '题意理解偏差'],
  },
  runtime_error: {
    name: '运行错误',
    description: '运行时崩溃（RE），例如段错误、越界、除零。',
    triggers: ['段错误', '越界', '除零', '爆栈', '空指针'],
  },
  time_limit: {
    name: '时间超限',
    description: '算法太慢，超出题目时间限制（TLE）。',
    triggers: ['O(n^2) 过高', '未优化', '常数大'],
  },
  memory_limit: {
    name: '内存超限',
    description: '占用的内存超过限制（MLE）。',
    triggers: ['数组过大', '递归太深', '未释放'],
  },
  output_format: {
    name: '输出格式错误',
    description: '输出与标准答案格式不一致（PE）。',
    triggers: ['多换行', '多空格', '大小写', '忘了 flush'],
  },
  concept_gap: {
    name: '概念理解不足',
    description: '尚未掌握题目涉及的算法或数据结构。',
    triggers: ['看不懂题', '没思路', '知识点缺失'],
  },
};
```

- [ ] **Step 3: taxonomy/index.ts**

```ts
import type { MistakeCode, MistakeLabel as DomainMistakeLabel } from '@/lib/mistake/domain/types';
import { type MistakeLabel, mathMistakeTaxonomy } from './math-taxonomy';
import { cppMistakeTaxonomy } from './cpp-taxonomy';

export type { MistakeLabel };

export class UnknownMistakeCodeError extends Error {
  constructor(public code: string) {
    super(`Unknown mistake code: ${code}`);
    this.name = 'UnknownMistakeCodeError';
  }
}

export function getMistakeLabel(code: MistakeCode): MistakeLabel {
  if (code in mathMistakeTaxonomy) return mathMistakeTaxonomy[code as keyof typeof mathMistakeTaxonomy];
  if (code in cppMistakeTaxonomy) return cppMistakeTaxonomy[code as keyof typeof cppMistakeTaxonomy];
  throw new UnknownMistakeCodeError(code);
}

export function getMistakeLabelOrThrow(code: string): MistakeLabel | null {
  try { return getMistakeLabel(code as MistakeCode); } catch { return null; }
}
```

- [ ] **Step 4: cpp-taxonomy.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { cppMistakeTaxonomy } from './cpp-taxonomy';
import type { CppMistakeCode } from '@/lib/mistake/domain/types';

describe('cppMistakeTaxonomy', () => {
  const codes: CppMistakeCode[] = [
    'compile_error', 'wrong_answer', 'runtime_error',
    'time_limit', 'memory_limit', 'output_format', 'concept_gap',
  ];

  it('covers every CppMistakeCode', () => {
    for (const code of codes) {
      expect(cppMistakeTaxonomy[code]).toBeDefined();
      expect(cppMistakeTaxonomy[code].name).toBeTruthy();
    }
  });
});
```

- [ ] **Step 5: 更新所有 `from '@/lib/mistake/taxonomy/mistake-taxonomy'` 引用为 `@/lib/mistake/taxonomy'`（指向 index.ts）**

涉及文件：
- `frontend/lib/mistake/diagnosis/diagnose.ts`（待 Task 5 拆）
- `frontend/lib/mistake/explain/explain.ts`（待 Task 6 拆）
- 其它 grep 命中处

```bash
cd frontend
rg -l "mistake/taxonomy/mistake-taxonomy" app lib
```

逐个替换 import 路径。

- [ ] **Step 6: 运行 vitest**

```bash
cd frontend && pnpm vitest run lib/mistake/taxonomy
```

预期：所有测试通过。

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(taxonomy): split math/cpp taxonomies with unified index"
```

---

## Task 5: diagnose 拆分（math 拆出 + cpp 新建 + dispatcher）

**Files:**
- Rename: `frontend/lib/mistake/diagnosis/diagnose.ts` → `frontend/lib/mistake/diagnosis/diagnose-math.ts`
- Create: `frontend/lib/mistake/diagnosis/diagnose-cpp.ts`
- Create: `frontend/lib/mistake/diagnosis/index.ts`
- Create: `frontend/lib/mistake/diagnosis/diagnose-cpp.test.ts`

- [ ] **Step 1: 重命名 diagnose.ts → diagnose-math.ts 并把导出函数改名**

```bash
git mv frontend/lib/mistake/diagnosis/diagnose.ts frontend/lib/mistake/diagnosis/diagnose-math.ts
```

然后编辑 `diagnose-math.ts`：

- 把 `inferMistakeCode` / `diagnoseMistake` 改为 `inferMathMistakeCode` / `diagnoseMathMistake`（内部命名）。
- import 改为 `from '../taxonomy'`（指向 index.ts）。
- 仅导出 `diagnoseMathMistake`。

- [ ] **Step 2: 新建 diagnose-cpp.ts**

```ts
import type { CppMistakeCode, DiagnosisResult, ProblemInput } from '@/lib/mistake/domain/types';
import { cppMistakeTaxonomy } from '../taxonomy/cpp-taxonomy';

type DiagnosisSummary = Pick<
  DiagnosisResult,
  'normalizedProblemText' | 'guessedMistake' | 'confidence' | 'knowledgePoint' | 'parentSummary'
>;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function inferCppMistakeCode(input: ProblemInput): { code: CppMistakeCode; confidence: number } {
  const text = normalizeText(input.problemText);
  const lower = text.toLowerCase();

  if (input.verdict === 'CE') return { code: 'compile_error', confidence: 0.95 };
  if (input.verdict === 'TLE' || /(超时|tle|复杂度过高)/i.test(text)) {
    return { code: 'time_limit', confidence: 0.85 };
  }
  if (input.verdict === 'MLE' || /(内存超限|mle|数组过大)/i.test(text)) {
    return { code: 'memory_limit', confidence: 0.85 };
  }
  if (input.verdict === 'RE' || /(段错误|越界|除零|爆栈|空指针)/i.test(text)) {
    return { code: 'runtime_error', confidence: 0.85 };
  }
  if (input.verdict === 'PE' || /(输出格式|换行|空格|忘了 flush)/i.test(text)) {
    return { code: 'output_format', confidence: 0.8 };
  }
  if (input.verdict === 'WA' && input.problemType === 'dp') {
    return { code: 'concept_gap', confidence: 0.65 };
  }
  if (input.verdict === 'WA') return { code: 'wrong_answer', confidence: 0.7 };
  if (input.verdict === 'AC') return { code: 'concept_gap', confidence: 0.4 };

  return { code: 'concept_gap', confidence: 0.5 };
}

export function diagnoseCppMistake(input: ProblemInput): DiagnosisSummary {
  const normalizedProblemText = normalizeText(input.problemText);
  const { code, confidence } = inferCppMistakeCode({
    ...input,
    problemText: normalizedProblemText,
  });
  const label = cppMistakeTaxonomy[code];

  return {
    normalizedProblemText,
    guessedMistake: code,
    confidence,
    knowledgePoint: label.name,
    parentSummary: {
      headline: `本次 C++ 错题更接近"${label.name}"。`,
      nextStep: `优先复习"${label.name}"相关知识点，并完成 2 道同类题验证。`,
    },
  };
}
```

- [ ] **Step 3: index.ts（dispatcher）**

```ts
import type { DiagnosisResult, ProblemInput } from '@/lib/mistake/domain/types';
import { diagnoseMathMistake } from './diagnose-math';
import { diagnoseCppMistake } from './diagnose-cpp';

export function diagnoseMistake(input: ProblemInput): Pick<
  DiagnosisResult,
  'normalizedProblemText' | 'guessedMistake' | 'confidence' | 'knowledgePoint' | 'parentSummary'
> {
  return input.subject === 'cpp' ? diagnoseCppMistake(input) : diagnoseMathMistake(input);
}
```

- [ ] **Step 4: diagnose-cpp.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { diagnoseCppMistake } from './diagnose-cpp';
import type { ProblemInput } from '@/lib/mistake/domain/types';

const base: ProblemInput = {
  grade: 8, subject: 'cpp', source: 'integration',
  problemText: '给定长度为 n 的数组，求最大子段和。',
};

describe('diagnoseCppMistake', () => {
  it('CE -> compile_error', () => {
    const r = diagnoseCppMistake({ ...base, verdict: 'CE' });
    expect(r.guessedMistake).toBe('compile_error');
    expect(r.confidence).toBeGreaterThan(0.9);
  });
  it('TLE -> time_limit', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'TLE' }).guessedMistake).toBe('time_limit');
  });
  it('MLE -> memory_limit', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'MLE' }).guessedMistake).toBe('memory_limit');
  });
  it('RE -> runtime_error', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'RE' }).guessedMistake).toBe('runtime_error');
  });
  it('PE -> output_format', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'PE' }).guessedMistake).toBe('output_format');
  });
  it('WA + dp -> concept_gap', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'WA', problemType: 'dp' }).guessedMistake).toBe('concept_gap');
  });
  it('WA alone -> wrong_answer', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'WA' }).guessedMistake).toBe('wrong_answer');
  });
  it('AC -> concept_gap', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'AC' }).guessedMistake).toBe('concept_gap');
  });
  it('default -> concept_gap', () => {
    const r = diagnoseCppMistake({ ...base });
    expect(r.guessedMistake).toBe('concept_gap');
  });
  it('keywords: 段错误 -> runtime_error even with WA', () => {
    const r = diagnoseCppMistake({ ...base, verdict: 'WA', problemText: '运行时出现段错误' });
    expect(r.guessedMistake).toBe('runtime_error');
  });
});
```

- [ ] **Step 5: 修正所有 import 路径**

把 `from '@/lib/mistake/diagnosis/diagnose'` 全部改为 `from '@/lib/mistake/diagnosis'`（指向 index.ts）。

- [ ] **Step 6: 跑 vitest**

```bash
cd frontend && pnpm vitest run lib/mistake/diagnosis
```

预期：math 旧测试 + 新增 cpp 测试全部通过。

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(diagnose): split math/cpp with subject dispatcher"
```

---

## Task 6: explain / practice 拆分

**Files:**
- Rename: `frontend/lib/mistake/explain/explain.ts` → `frontend/lib/mistake/explain/math-explain.ts`
- Create: `frontend/lib/mistake/explain/cpp-explain.ts`
- Create: `frontend/lib/mistake/explain/index.ts`
- Rename: `frontend/lib/mistake/practice/generate-practice.ts` → `frontend/lib/mistake/practice/math-practice.ts`
- Create: `frontend/lib/mistake/practice/cpp-practice.ts`
- Create: `frontend/lib/mistake/practice/index.ts`

- [ ] **Step 1: 重命名并改内部 export**

```bash
git mv frontend/lib/mistake/explain/explain.ts frontend/lib/mistake/explain/math-explain.ts
git mv frontend/lib/mistake/practice/generate-practice.ts frontend/lib/mistake/practice/math-practice.ts
```

把 `explainForChild` 改为 `explainMathForChild`（仅本文件内）；`generatePractice` 改为 `generateMathPractice`。import `from '@/lib/mistake/taxonomy'`。

- [ ] **Step 2: cpp-explain.ts**

```ts
import type { CppMistakeCode } from '@/lib/mistake/domain/types';
import { cppMistakeTaxonomy } from '../taxonomy/cpp-taxonomy';

const map: Record<Exclude<CppMistakeCode, 'concept_gap'>, string> = {
  compile_error: '这段代码没通过编译，先把编译器报的第一行错误看清楚，再回去查那一行附近的语法。',
  wrong_answer: '这段代码能跑出结果但答案是错的。先用最简单的样例手算一遍，再把代码每一步的中间值打出来对比。',
  runtime_error: '程序在运行时崩溃了，常见原因是数组越界、除零、指针为空或递归太深。先把出问题的输入范围列出来，再回去查对应分支。',
  time_limit: '你的算法太慢。先估算当前复杂度，如果题目数据大就要换更快的思路（比如用前缀和、单调队列、二分等）。',
  memory_limit: '占的内存太大了。先看看是不是数组开大了，或者递归/栈太深，能改成迭代或扩大用堆就更好。',
  output_format: '输出和标准答案格式不一致。常见问题：多一个换行或少一个空格、大小写错了、忘了输出换行。用 diff 工具对着样例对比最快。',
};

export function explainCppForChild(code: CppMistakeCode, problemText?: string): string {
  if (code === 'concept_gap') {
    return `这道题更像是${cppMistakeTaxonomy.concept_gap.name}。先把题目意思、输入、输出和样例说清楚，再想用什么算法。`;
  }
  return map[code];
}
```

- [ ] **Step 3: explain/index.ts**

```ts
import type { MistakeCode } from '@/lib/mistake/domain/types';
import { explainMathForChild } from './math-explain';
import { explainCppForChild } from './cpp-explain';

export function explainForChild(code: MistakeCode, problemText?: string): string {
  if (code in {
    compile_error: 1, wrong_answer: 1, runtime_error: 1,
    time_limit: 1, memory_limit: 1, output_format: 1,
  }) {
    return explainCppForChild(code as 'compile_error' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'output_format', problemText);
  }
  return explainMathForChild(code, problemText);
}
```

- [ ] **Step 4: cpp-practice.ts**

```ts
import type { CppMistakeCode, PracticeSuggestion } from '@/lib/mistake/domain/types';

const map: Record<CppMistakeCode, [PracticeSuggestion, PracticeSuggestion]> = {
  compile_error: [
    { prompt: '把下面这段代码改对：int a = 1 cout << a', answer: 'int a = 1; cout << a;' },
    { prompt: '检查你的代码：是否每个 if/for 都有花括号？', answer: '加花括号' },
  ],
  wrong_answer: [
    { prompt: '用样例 1 手算一遍，再把代码每步中间值打出来对比', answer: '找到第一个不一致的步骤' },
    { prompt: '边界条件都覆盖了吗？n=0、n=1、最大最小值？', answer: '补边界测试' },
  ],
  runtime_error: [
    { prompt: '检查所有数组下标是否可能越界', answer: '加范围判断' },
    { prompt: '递归深度是否可能超过 10^5？', answer: '改成迭代或加大栈' },
  ],
  time_limit: [
    { prompt: '把 O(n^2) 改写成 O(n log n) 或 O(n)', answer: '用更快的算法' },
    { prompt: '用前缀和 / 双指针 / 二分 优化', answer: '减少嵌套循环' },
  ],
  memory_limit: [
    { prompt: '把 vector<int> 改成 vector<short> 或位图', answer: '减小每个元素' },
    { prompt: '释放不需要的 vector', answer: '用 .clear() + shrink_to_fit()' },
  ],
  output_format: [
    { prompt: '用 diff 对比输出和样例，注意空格、换行、大小写', answer: '修正格式' },
    { prompt: '所有 cout 是否都加了 endl 或 \\n？', answer: '加换行' },
  ],
  concept_gap: [
    { prompt: '把题目的输入、输出、样例说一遍', answer: '按题意复述即可' },
    { prompt: '先想用什么算法 / 数据结构，再开始写', answer: '列出思路再写代码' },
  ],
};

export function generateCppPractice(code: CppMistakeCode): PracticeSuggestion[] {
  return map[code];
}
```

- [ ] **Step 5: practice/index.ts**

```ts
import type { MistakeCode, PracticeSuggestion } from '@/lib/mistake/domain/types';
import { generateMathPractice } from './math-practice';
import { generateCppPractice } from './cpp-practice';

export function generatePractice(code: MistakeCode): PracticeSuggestion[] {
  if (code in {
    compile_error: 1, wrong_answer: 1, runtime_error: 1,
    time_limit: 1, memory_limit: 1, output_format: 1,
  }) {
    return generateCppPractice(code as 'compile_error' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'output_format');
  }
  return generateMathPractice(code);
}
```

- [ ] **Step 6: 修正 import 路径**

把 `from '@/lib/mistake/explain/explain'` 改为 `from '@/lib/mistake/explain'`；practice 同理。

- [ ] **Step 7: 跑 vitest**

```bash
cd frontend && pnpm vitest run lib/mistake
```

预期：所有现有 math 测试 + 新建测试通过。

- [ ] **Step 8: commit**

```bash
git add -A
git commit -m "refactor(explain/practice): split math/cpp with subject dispatcher"
```

---

## Task 7: integration schemas（zod）

**Files:**
- Create: `frontend/lib/integrations/schemas.ts`
- Create: `frontend/lib/integrations/schemas.test.ts`

- [ ] **Step 1: schemas.ts**

```ts
import { z } from 'zod';

export const SUBJECTS = ['math', 'cpp'] as const;
export const VERDICTS = ['AC', 'WA', 'TLE', 'RE', 'CE', 'MLE', 'PE'] as const;
export const PROBLEM_TYPES = ['dp', 'greedy', 'brute', 'graph', 'string', 'math', 'other'] as const;

export const MAX_PROBLEM_CHARS = 8000;
export const MAX_ANSWER_CHARS = 4000;
export const MAX_TITLE_CHARS = 200;
export const MAX_SOURCE_CHARS = 64;

export const createMistakeJobSchema = z.object({
  subject: z.literal('cpp'),  // MVP: 只放行 cpp
  grade: z.number().int().min(1).max(12),
  verdict: z.enum(VERDICTS),
  problemText: z.string().min(1).max(MAX_PROBLEM_CHARS),
  studentAnswer: z.string().max(MAX_ANSWER_CHARS).optional(),
  correctAnswer: z.string().max(MAX_ANSWER_CHARS).optional(),
  problemType: z.enum(PROBLEM_TYPES).optional(),
  title: z.string().max(MAX_TITLE_CHARS).optional(),
  source: z.string().max(MAX_SOURCE_CHARS).optional(),
});

export type CreateMistakeJobInput = z.infer<typeof createMistakeJobSchema>;
```

- [ ] **Step 2: schemas.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { createMistakeJobSchema, MAX_PROBLEM_CHARS } from './schemas';

describe('createMistakeJobSchema', () => {
  it('accepts a minimal valid request', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: '给定数组求最大子段和。',
    });
    expect(r.success).toBe(true);
  });

  it('rejects math subject (MVP scope: cpp only)', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'math', grade: 4, verdict: 'WA',
      problemText: '36 + 27',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty problemText', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects problemText over MAX_PROBLEM_CHARS', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: 'a'.repeat(MAX_PROBLEM_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown verdict', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'XX', problemText: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('accepts problemType and title as optional', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'x',
      problemType: 'dp', title: 'P1115',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 3: 跑 vitest**

```bash
cd frontend && pnpm vitest run lib/integrations/schemas
```

- [ ] **Step 4: commit**

```bash
git add frontend/lib/integrations
git commit -m "feat(integrations): add zod schemas for create-job endpoint"
```

---

## Task 8: rate limiter

**Files:**
- Create: `frontend/lib/integrations/rate-limit.ts`
- Create: `frontend/lib/integrations/errors.ts`
- Create: `frontend/lib/integrations/rate-limit.test.ts`

- [ ] **Step 1: errors.ts**

```ts
export class RateLimitedError extends Error {
  constructor(public retryAfterSec: number) {
    super(`Rate limited; retry after ${retryAfterSec}s`);
    this.name = 'RateLimitedError';
  }
}
```

- [ ] **Step 2: rate-limit.ts**

```ts
import { RateLimitedError } from './errors';

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (bucket.timestamps.length && bucket.timestamps[0] < cutoff) {
    bucket.timestamps.shift();
  }
}

export function checkRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    throw new RateLimitedError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }
  bucket.timestamps.push(now);
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
```

- [ ] **Step 3: rate-limit.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { checkRateLimit, getClientIp } from './rate-limit';
import { RateLimitedError } from './errors';

describe('checkRateLimit', () => {
  it('allows up to limit, then throws', () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(() => checkRateLimit(key, 3, 60_000)).toThrow(RateLimitedError);
  });

  it('isolates buckets by key', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(() => checkRateLimit(b, 1, 60_000)).not.toThrow();
  });
});

describe('getClientIp', () => {
  it('uses first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });
  it('falls back to unknown', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});
```

- [ ] **Step 4: 跑 vitest**

```bash
cd frontend && pnpm vitest run lib/integrations
```

- [ ] **Step 5: commit**

```bash
git add frontend/lib/integrations
git commit -m "feat(integrations): add in-memory rate limiter"
```

---

## Task 9: integration store（CRUD）

**Files:**
- Create: `frontend/lib/integrations/store.ts`

- [ ] **Step 1: store.ts**

```ts
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { CreateMistakeJobInput } from './schemas';

export type IntegrationJobStatus = 'queued' | 'running' | 'ready' | 'failed';
export type IntegrationJobStage = 'diagnosing' | null;

export interface IntegrationJob {
  id: string;
  subject: string;
  source: string | null;
  requestPayload: Record<string, unknown>;
  status: IntegrationJobStatus;
  stage: IntegrationJobStage;
  sessionId: string | null;
  classroomId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  ip: string;
  ua: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

export function createIntegrationJob(input: {
  request: CreateMistakeJobInput;
  ip: string;
  ua: string | null;
}): IntegrationJob {
  const id = `ij_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = nowIso();
  const expires = new Date(Date.now() + TTL_MS).toISOString();
  const payload = JSON.stringify({
    subject: input.request.subject,
    source: input.request.source ?? null,
    request: input.request,
  });
  db.integrationJob.create({ data: { id, ...input, requestPayload: payload, expiresAt: expires, now } });
  return readIntegrationJob(id)!;
}

export function readIntegrationJob(id: string): IntegrationJob | null {
  return db.integrationJob.findUnique({ where: { id } });
}

export function updateIntegrationJob(
  id: string,
  patch: Partial<Pick<IntegrationJob,
    'status' | 'stage' | 'sessionId' | 'classroomId' | 'errorCode' | 'errorMessage'>>,
): IntegrationJob | null {
  db.integrationJob.update({ where: { id }, data: { ...patch, updatedAt: nowIso() } });
  return readIntegrationJob(id);
}
```

注意：上面示例使用了 `db.integrationJob.create / findUnique / update`，**实际项目里的 db.ts 没有这个 model**，需要在 Task 3 之后给 db.ts 加上：

```ts
// 在 db.ts 暴露的 db 对象中追加：
integrationJob: {
  create: ({ data }: { data: any }) => {
    const stmt = getDb().prepare(`INSERT INTO integration_jobs
      (id, subject, source, request_payload, status, stage, session_id, classroom_id,
       error_code, error_message, ip, ua, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(data.id, data.subject, data.source ?? null, data.requestPayload, 'queued',
      null, null, null, null, null, data.ip, data.ua ?? null, data.expiresAt, data.now, data.now);
  },
  findUnique: ({ where }: { where: any }) => {
    const row = getDb().prepare(`SELECT * FROM integration_jobs WHERE id = ?`).get(where.id);
    if (!row) return null;
    return {
      id: row.id, subject: row.subject, source: row.source,
      requestPayload: JSON.parse(row.request_payload),
      status: row.status, stage: row.stage,
      sessionId: row.session_id, classroomId: row.classroom_id,
      errorCode: row.error_code, errorMessage: row.error_message,
      ip: row.ip, ua: row.ua, expiresAt: row.expires_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  },
  update: ({ where, data }: { where: any; data: any }) => {
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id') continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    vals.push(where.id);
    getDb().prepare(`UPDATE integration_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
},
```

（实现细节：参考 db.ts 现有 `mistakeRecord` 的写法。）

- [ ] **Step 2: 跑 vitest**

```bash
cd frontend && pnpm vitest run lib/integrations
```

- [ ] **Step 3: commit**

```bash
git add frontend/lib/integrations frontend/lib/db.ts
git commit -m "feat(integrations): CRUD store over integration_jobs"
```

---

## Task 10: integration runner

**Files:**
- Create: `frontend/lib/integrations/runner.ts`

- [ ] **Step 1: runner.ts**

```ts
import { nanoid } from 'nanoid';
import { createMistakeSession } from '@/lib/mistake/session/store';
import { diagnoseCppMistake } from '@/lib/mistake/diagnosis/diagnose-cpp';
import { buildMistakeClassroomRequirement } from '@/lib/mistake/openmaic/build-requirement';
import type { CreateMistakeJobInput } from './schemas';
import { readIntegrationJob, updateIntegrationJob } from './store';

export async function runIntegrationJob(jobId: string): Promise<void> {
  const job = readIntegrationJob(jobId);
  if (!job) return;
  if (job.status !== 'queued') return;

  updateIntegrationJob(jobId, { status: 'running', stage: 'diagnosing' });

  try {
    const request = job.requestPayload.request as CreateMistakeJobInput;

    // 1. 跑 C++ 诊断
    const diagnosis = diagnoseCppMistake({
      grade: request.grade,
      subject: 'cpp',
      source: 'integration',
      problemText: request.problemText,
      studentAnswer: request.studentAnswer,
      correctAnswer: request.correctAnswer,
      verdict: request.verdict,
      problemType: request.problemType,
      title: request.title,
    });

    // 2. 建 mistake session（用 session 的 store，写到 JSON 文件 + mistake_records）
    const sessionId = `ms_${nanoid(10)}`;
    await createMistakeSession({
      subject: 'cpp',
      source: 'integration',
      ocr: {
        problemText: request.problemText,
        studentAnswer: request.studentAnswer,
        correctAnswerCandidate: request.correctAnswer,
        confidence: 1.0,
      },
      confirmed: {
        problemText: request.problemText,
        studentAnswer: request.studentAnswer,
        correctAnswer: request.correctAnswer,
      },
      status: 'ready_to_generate',
    });

    // 3. 把诊断快照塞到 session 的 confirmed 里（轻量：覆盖 correctAnswerCandidate）
    // 不需要：诊断只用于 generation-preview 内部，session 仅承担"题目已就绪"语义

    updateIntegrationJob(jobId, { status: 'ready', stage: null, sessionId });
  } catch (err: any) {
    updateIntegrationJob(jobId, {
      status: 'failed',
      errorCode: 'INTERNAL',
      errorMessage: err?.message ?? 'Unknown error',
    });
  }
}
```

- [ ] **Step 2: 跑 vitest + tsc**

```bash
cd frontend && npx tsc --noEmit && pnpm vitest run lib/integrations
```

- [ ] **Step 3: commit**

```bash
git add frontend/lib/integrations/runner.ts
git commit -m "feat(integrations): async job runner prepares session for cpp"
```

---

## Task 11: POST /api/integrations/mistake

**Files:**
- Create: `frontend/app/api/integrations/mistake/route.ts`
- Create: `frontend/app/api/integrations/mistake/route.test.ts`

- [ ] **Step 1: route.ts**

```ts
import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { trackEvent } from '@/lib/usage/track';
import { createMistakeJobSchema } from '@/lib/integrations/schemas';
import { createIntegrationJob } from '@/lib/integrations/store';
import { runIntegrationJob } from '@/lib/integrations/runner';
import { checkRateLimit, getClientIp } from '@/lib/integrations/rate-limit';
import { RateLimitedError } from '@/lib/integrations/errors';

const CREATE_LIMIT = Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10);

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);

  try {
    checkRateLimit(`create:${ip}`, CREATE_LIMIT, 60_000);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return apiError('RATE_LIMITED', 429, err.message, {
        'Retry-After': String(err.retryAfterSec),
      });
    }
    throw err;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return apiError('INVALID_CONTENT_TYPE', 415, 'Content-Type must be application/json');
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError('INVALID_JSON', 400, '请求体必须是合法 JSON'); }

  const parsed = createMistakeJobSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, '请求体字段不合法', undefined, {
      issues: parsed.error.issues,
    });
  }

  const job = createIntegrationJob({
    request: parsed.data,
    ip,
    ua: request.headers.get('user-agent'),
  });

  // 后台触发；不 await；失败时 runner 自己写 fail 状态
  void runIntegrationJob(job.id).catch(() => {});

  void trackEvent('integration.mistake.create', {
    jobId: job.id, subject: job.subject, source: job.source, ip,
  }, { request });

  return apiSuccess(
    {
      jobId: job.id,
      status: 'queued' as const,
      statusUrl: `/api/integrations/jobs/${job.id}`,
    },
    201,
  );
}
```

注：实际 `apiSuccess` / `apiError` 的签名请以 [`lib/server/api-response.ts`](file:///d:/AItrade/ai-math-mistake-machine/frontend/lib/server/api-response.ts) 为准。如签名不同，按需微调。

- [ ] **Step 2: route.test.ts**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/usage/track', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/integrations/runner', () => ({ runIntegrationJob: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db', () => ({ db: { integrationJob: { /* in-memory mock */ } } }));

import { POST } from './route';

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/integrations/mistake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/mistake', () => {
  it('returns 201 + jobId for valid cpp request', async () => {
    const res = await POST(jsonRequest({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: '求最大子段和。', problemType: 'dp', title: 'P1115',
      source: 'vjudge-ai-report',
    }) as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.jobId).toMatch(/^ij_/);
    expect(json.statusUrl).toContain('/api/integrations/jobs/');
  });

  it('returns 400 for math subject (out of MVP scope)', async () => {
    const res = await POST(jsonRequest({
      subject: 'math', grade: 4, verdict: 'WA', problemText: 'x',
    }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing problemText', async () => {
    const res = await POST(jsonRequest({
      subject: 'cpp', grade: 8, verdict: 'WA',
    }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 415 for non-json content-type', async () => {
    const req = new Request('http://localhost/api/integrations/mistake', {
      method: 'POST', headers: { 'content-type': 'text/plain' },
      body: 'subject=cpp',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(415);
  });

  it('returns 429 when over rate limit', async () => {
    // 用一个 unique 标识：设置 1 次的限制
    process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN = '1';
    await POST(jsonRequest({ subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'a' }) as any);
    const res = await POST(jsonRequest({ subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'b' }) as any);
    expect(res.status).toBe(429);
    delete process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN;
  });
});
```

- [ ] **Step 3: 跑 vitest**

```bash
cd frontend && pnpm vitest run app/api/integrations
```

- [ ] **Step 4: commit**

```bash
git add frontend/app/api/integrations
git commit -m "feat(integrations): POST /api/integrations/mistake"
```

---

## Task 12: GET /api/integrations/jobs/[id]

**Files:**
- Create: `frontend/app/api/integrations/jobs/[id]/route.ts`
- Create: `frontend/app/api/integrations/jobs/[id]/route.test.ts`

- [ ] **Step 1: route.ts**

```ts
import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { checkRateLimit, getClientIp } from '@/lib/integrations/rate-limit';
import { RateLimitedError } from '@/lib/integrations/errors';
import { readIntegrationJob } from '@/lib/integrations/store';

const POLL_LIMIT = Number(process.env.RATE_LIMIT_INTEGRATION_POLL_PER_MIN ?? 120);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(request.headers);
  try {
    checkRateLimit(`poll:${ip}`, POLL_LIMIT, 60_000);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return apiError('RATE_LIMITED', 429, err.message, {
        'Retry-After': String(err.retryAfterSec),
      });
    }
    throw err;
  }

  const job = readIntegrationJob(params.id);
  if (!job) return apiError('JOB_NOT_FOUND', 404, 'job not found');

  const now = Date.now();
  const expiresAt = Date.parse(job.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt < now) {
    return apiError('JOB_EXPIRED', 410, 'job expired');
  }

  const sessionId = job.sessionId;
  const generationUrl = sessionId
    ? `/generation-preview?session=${sessionId}&from=integration`
    : null;
  const classroomUrl = job.classroomId ? `/classroom/${job.classroomId}` : null;

  return apiSuccess({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    sessionId,
    generationUrl,
    classroomUrl,
    error: job.status === 'failed'
      ? { code: job.errorCode, message: job.errorMessage }
      : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
```

- [ ] **Step 2: route.test.ts**

```ts
import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/integrations/store', () => ({
  readIntegrationJob: vi.fn().mockImplementation((id: string) => ({
    ij_ok: { id, subject: 'cpp', source: null, requestPayload: {},
      status: 'ready', stage: null, sessionId: 'ms_1', classroomId: null,
      errorCode: null, errorMessage: null, ip: '127.0.0.1', ua: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: '...', updatedAt: '...' },
    ij_expired: { id, status: 'ready', sessionId: null, classroomId: null,
      errorCode: null, errorMessage: null, requestPayload: {}, subject: 'cpp',
      source: null, stage: null, ip: '127.0.0.1', ua: null,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: '...', updatedAt: '...' },
  }[id] ?? null)),
}));

function req(id: string) {
  return new Request(`http://localhost/api/integrations/jobs/${id}`) as any;
}

describe('GET /api/integrations/jobs/[id]', () => {
  it('returns 200 with generationUrl when ready', async () => {
    const res = await GET(req('ij_ok'), { params: { id: 'ij_ok' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ready');
    expect(json.generationUrl).toContain('/generation-preview?session=ms_1');
  });

  it('returns 410 when expired', async () => {
    const res = await GET(req('ij_expired'), { params: { id: 'ij_expired' } });
    expect(res.status).toBe(410);
  });

  it('returns 404 when not found', async () => {
    const res = await GET(req('ij_missing'), { params: { id: 'ij_missing' } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: 跑 vitest**

```bash
cd frontend && pnpm vitest run app/api/integrations/jobs
```

- [ ] **Step 4: commit**

```bash
git add frontend/app/api/integrations/jobs
git commit -m "feat(integrations): GET /api/integrations/jobs/[id] with state machine"
```

---

## Task 13: POST /api/integrations/jobs/[id]/retry

**Files:**
- Create: `frontend/app/api/integrations/jobs/[id]/retry/route.ts`

- [ ] **Step 1: route.ts**

```ts
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readIntegrationJob, updateIntegrationJob } from '@/lib/integrations/store';
import { runIntegrationJob } from '@/lib/integrations/runner';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const job = readIntegrationJob(params.id);
  if (!job) return apiError('JOB_NOT_FOUND', 404, 'job not found');
  if (job.status !== 'failed' && job.status !== 'running') {
    return apiError('INVALID_STATE', 409, `cannot retry in status ${job.status}`);
  }

  updateIntegrationJob(params.id, {
    status: 'queued', stage: null,
    errorCode: null, errorMessage: null,
  });
  void runIntegrationJob(params.id).catch(() => {});
  return apiSuccess({ jobId: params.id, status: 'queued' });
}
```

- [ ] **Step 2: commit**

```bash
git add frontend/app/api/integrations/jobs/\[id\]/retry
git commit -m "feat(integrations): retry endpoint for stuck/failed jobs"
```

---

## Task 14: GET /api/integrations/health

**Files:**
- Create: `frontend/app/api/integrations/health/route.ts`

- [ ] **Step 1: route.ts**

```ts
import { apiSuccess } from '@/lib/server/api-response';

export async function GET() {
  return apiSuccess({
    status: 'ok',
    subjects: ['math', 'cpp'],
    rateLimits: {
      createPerMin: Number(process.env.RATE_LIMIT_INTEGRATION_CREATE_PER_MIN ?? 10),
      pollPerMin: Number(process.env.RATE_LIMIT_INTEGRATION_POLL_PER_MIN ?? 120),
    },
  });
}
```

- [ ] **Step 2: commit**

```bash
git add frontend/app/api/integrations/health
git commit -m "feat(integrations): health endpoint"
```

---

## Task 15: mistake 路由放行 cpp subject

**Files:**
- Modify: `frontend/app/api/mistake/session/route.ts`
- Modify: `frontend/app/api/mistake/session/analyze/route.ts`

- [ ] **Step 1: analyze/route.ts 的 zod 改 union**

把 `subject: z.literal('math')` 改为 `subject: z.union([z.literal('math'), z.literal('cpp')])`。

- [ ] **Step 2: session/route.ts 的 zod 改 union**

把 `subject?: z.union(...)` 视实际 schema 调整；通常 `source` 的 union 不变，但需允许 `studentProfileId` 不传。

- [ ] **Step 3: 跑 vitest**

```bash
cd frontend && pnpm vitest run app/api/mistake
```

预期：现有测试通过。

- [ ] **Step 4: commit**

```bash
git add frontend/app/api/mistake
git commit -m "feat(api): accept subject=cpp in existing mistake endpoints"
```

---

## Task 16: build-requirement subject 分支

**Files:**
- Modify: `frontend/lib/mistake/openmaic/build-requirement.ts`

- [ ] **Step 1: 改 build-requirement.ts**

```ts
import type { MistakeClassroomInput } from './types';

function normalizeText(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildMistakeClassroomRequirement(input: MistakeClassroomInput): string {
  const problemText = normalizeText(input.problemText);
  if (!problemText) throw new Error('problemText is required');

  const studentAnswer = normalizeText(input.studentAnswer);
  const correctAnswer = normalizeText(input.correctAnswer);
  const studentName = normalizeText(input.studentName) || '同学';

  if (input.subject === 'cpp') {
    return [
      `请为信息学/算法竞赛学习者${studentName}讲解这道 C++/算法题：${problemText}`,
      `本题常见错误：${studentAnswer ?? '未提供'}`,
      `期望结果：${correctAnswer ?? '未提供'}`,
      `请按"题意理解 → 思路 → 复杂度 → 代码"四步给出可执行的讲解。`,
    ].join('\n');
  }

  return [
    `请为小学${input.grade}年级学生${studentName}讲解这道数学题：${problemText}`,
    `学生答案：${studentAnswer ?? '未提供'}`,
    `正确答案：${correctAnswer ?? '未提供'}`,
  ].join('\n');
}
```

- [ ] **Step 2: tsc**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: commit**

```bash
git add frontend/lib/mistake/openmaic/build-requirement.ts
git commit -m "feat(openmaic): branch classroom requirement by subject"
```

---

## Task 17: 端到端 smoke（手动 + 文档）

**Files:**
- Modify: `docs/superpowers/specs/2026-07-02-thirdparty-mistake-ingest-design.md` 末尾追加"接入示例"链接到 README（可选）
- Create or Modify: `frontend/app/api/integrations/README.md`（可选）

- [ ] **Step 1: dev server 启动**

```bash
cd frontend && pnpm dev
```

- [ ] **Step 2: 走通 curl 流**

```bash
# 1) 创建 job
curl -X POST http://localhost:3000/api/integrations/mistake \
  -H "Content-Type: application/json" \
  -d '{
    "subject":"cpp",
    "grade":8,
    "verdict":"WA",
    "problemText":"给定一个长度为 n 的数组，求最大子段和。",
    "problemType":"dp",
    "title":"P1115",
    "source":"vjudge-ai-report"
  }'
# 期望：201 + { jobId, status: "queued", statusUrl }

# 2) 轮询
curl http://localhost:3000/api/integrations/jobs/<jobId>
# 期望：{ status: "ready", sessionId, generationUrl }

# 3) 浏览器打开 generationUrl
# 期望：/generation-preview 加载并开始生成大纲/场景
```

- [ ] **Step 3: 跑完整测试套件**

```bash
cd frontend && pnpm vitest run
```

预期：所有测试通过。

- [ ] **Step 4: commit（如有改动）**

```bash
git status
# 视情况 commit
```

---

## Self-Review Notes

- Spec 6.1/6.2 字段与 Task 1 保持一致：`Subject`、`MistakeCode` union、`verdict`、`problemType` 全部对齐。
- Task 9 中 `db.integrationJob` 的 schema 实际在 db.ts 内实现细节依赖现有 `mistakeRecord` 的写法；测试通过 `vi.mock` 隔离。
- Task 11/12 的 `apiSuccess` / `apiError` 签名以 `lib/server/api-response.ts` 为准；如发现差异，按需微调。
- Task 14 的 health 不在 spec 限流范围内，跳过 checkRateLimit。
- Task 15 涉及现有路由的 zod 放宽，必须保证现有测试不回归。

