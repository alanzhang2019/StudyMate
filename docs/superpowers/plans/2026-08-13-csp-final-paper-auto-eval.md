# 交卷自动全部测评 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSP 真题卷交卷时，对所有已有本地答案的 scene（包括 short_answer 简答题）自动跑完整测评并纳入总分，学生无需先逐个点击"提交答案"。

**Architecture:**
- 抽 `gradeSceneFully(sceneId, sceneQuestions, sceneAnswers, locale)` 公共函数：先选已持久化的 `quizResults:<sceneId>`（reviewing 状态），否则对选择题本地 gradeChoiceQuestions + 对 short_answer 调 `/api/quiz-grade`，复用现有 `gradeShortAnswerQuestion` 单题 AI 评分。
- 在 `handleFinalize` 里把"对其他 scene 强制记 correct: false"那段替换为：每个 scene 都跑 `gradeSceneFully` 得到真实结果，再 `reportQuizSubmit` 上报。
- 当前 scene 走同样的 `gradeSceneFully`（用 in-memory `results` 或 `quizResults:<sceneId>` 作为 reviewing 缓存），保持原语义。
- AI 失败 fallback 沿用 `gradeShortAnswerQuestion` 自带的"基础分"逻辑，不需新增降级代码。

**Tech Stack:** Next.js 14 App Router · TypeScript · React Hooks · Tailwind · localStorage · 已有的 `use-csp-progress` + `/api/quiz-grade` + `/api/csp-quiz/submit` + `/api/csp-quiz/finalize-classroom`

---

## File Structure

### 修改
| 文件 | 改动 |
|------|------|
| `frontend/components/scene-renderers/quiz-view.tsx` | 抽 `gradeSceneFully` helper；`handleFinalize` 对所有 scene 改用真实测评结果；引入 `readSubmittedState` + `writeSubmittedResults`；deps 加 `cspProgress`、`locale`、移除 `results`、`questions` 闭包中不再需要的项 |

### 测试
| 文件 | 类型 |
|------|------|
| `frontend/components/scene-renderers/quiz-view.test.ts`（新建） | vitest：测 `gradeSceneFully` 的（a）选择题本地 grade、（b）已 reviewing 复用、（c）short_answer 调 mock 的 fetch、（d）AI 失败 fallback、（e）空 answers 抛错 |

无新增 / 修改后端 endpoint，无 DB schema 改动。

---

## Task 1: 抽 `gradeSceneFully` helper 并写单测

**Files:**
- Modify: `frontend/components/scene-renderers/quiz-view.tsx`（在 `pickChoice` 之后新增 `gradeSceneFully`；在 `handleSubmit`/`handleFinalize` 之前）
- Create: `frontend/components/scene-renderers/quiz-view.test.ts`（vitest）

- [ ] **Step 1: 看现有 imports 找 `readSubmittedState` / `writeSubmittedResults` 是不是已 import**

Run: 用 Grep 在 `frontend/components/scene-renderers/quiz-view.tsx` 搜 `readSubmittedState|writeSubmittedResults`。
Expected: 两者都已在 import 列表（line 35-46），无需新增 import。

- [ ] **Step 2: 写失败测试**

新建 `frontend/components/scene-renderers/quiz-view.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gradeSceneFully } from '@/components/scene-renderers/quiz-view';

// Mock the entire @/lib/utils/model-config so gradeSceneFully
// can build the fetch headers without crashing under vitest.
vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: () => ({
    modelString: 'mock',
    apiKey: 'mock',
    baseUrl: '',
    providerType: '',
  }),
}));

const makeChoiceQ = (id: string, answer: string, points = 1) =>
  ({
    id,
    type: 'choice' as const,
    question: `q-${id}`,
    options: ['A', 'B'],
    answer,
    points,
  }) as any;

const makeShortQ = (id: string, points = 2) =>
  ({
    id,
    type: 'short_answer' as const,
    question: `q-${id}`,
    answer: ['ref'],
    points,
    commentPrompt: 'p',
  }) as any;

describe('gradeSceneFully', () => {
  beforeEach(() => {
    // Make localStorage deterministic; gradeSceneFully reads
    // quizResults:<sceneId> as a "reviewing cache" fast path.
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grades only-choice questions locally', async () => {
    const qs = [makeChoiceQ('q1', 'A'), makeChoiceQ('q2', 'B')];
    const answers = { q1: 'A', q2: 'C' };
    const out = await gradeSceneFully('s1', qs, answers, 'zh-CN');
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.questionId === 'q1')?.status).toBe('correct');
    expect(out.find((r) => r.questionId === 'q2')?.status).toBe('incorrect');
  });

  it('reuses persisted results when scene already reviewing', async () => {
    window.localStorage.setItem(
      'quizResults:s2',
      JSON.stringify([
        { questionId: 'q1', correct: true, status: 'correct', earned: 1 },
      ]),
    );
    const fetchSpy = vi.spyOn(global, 'fetch');
    const out = await gradeSceneFully('s2', [makeChoiceQ('q1', 'A')], { q1: 'A' }, 'zh-CN');
    expect(out).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls /api/quiz-grade for short_answer questions', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ score: 2, comment: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const out = await gradeSceneFully('s3', [makeShortQ('q1', 2)], { q1: 'answer' }, 'zh-CN');
    expect(out[0].earned).toBe(2);
    expect(out[0].status).toBe('correct');
    expect(fetchSpy).toHaveBeenCalledWith('/api/quiz-grade', expect.any(Object));
  });

  it('falls back to half credit when AI grading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const out = await gradeSceneFully('s4', [makeShortQ('q1', 2)], { q1: 'x' }, 'zh-CN');
    expect(out[0].earned).toBe(1); // round(2 * 0.5) = 1
    expect(out[0].status).toBe('incorrect');
    expect(out[0].aiComment).toContain('暂时不可用');
  });

  it('returns empty array when no answers are provided', async () => {
    const out = await gradeSceneFully('s5', [makeChoiceQ('q1', 'A')], {}, 'zh-CN');
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 3: 跑测试确认红**

Run: `cd frontend && npx vitest run components/scene-renderers/quiz-view.test.ts`
Expected: 全部失败（`gradeSceneFully` 还不存在），最末一行含 `Failed to resolve import "gradeSceneFully"` 或 `gradeSceneFully is not a function`。

- [ ] **Step 4: 在 quiz-view.tsx 抽出 `gradeSceneFully`**

在 `pickChoice` 之后（line 61 之后）插入：

```ts
/**
 * Grade every question in a single scene end-to-end:
 *   1. If the scene already has persisted `quizResults:<sceneId>`
 *      (i.e. the student has hit 提交答案 before and the reviewing
 *      cache is still there), return it as-is. This is the fast
 *      path: no AI round-trips, no re-grading.
 *   2. Otherwise, locally grade choice questions and concurrently
 *      AI-grade short_answer questions via /api/quiz-grade. Returns
 *      a single QuestionResult[] in the original question order
 *      (matching the per-scene grading useEffect's contract).
 *
 * The function is intentionally exported (named export only) so
 * vitest can import it from quiz-view.test.ts without rendering
 * the whole component.
 */
export async function gradeSceneFully(
  sceneId: string,
  sceneQuestions: QuizQuestion[],
  sceneAnswers: Record<string, string | string[]>,
  locale: string,
): Promise<QuestionResult[]> {
  if (Object.keys(sceneAnswers).length === 0) return [];

  // Fast path: re-use the reviewing cache the per-scene grading
  // useEffect already wrote. Avoids redundant AI calls when the
  // student has already finished this scene.
  const persisted = readSubmittedState(sceneId);
  if (persisted?.kind === 'reviewing' && persisted.results.length > 0) {
    return persisted.results;
  }

  // Slow path: local grade for choice + AI grade for short_answer.
  const choiceResults = gradeChoiceQuestions(sceneQuestions, sceneAnswers);
  const shortAnswerQs = sceneQuestions.filter(isShortAnswer);
  const shortResults = await Promise.all(
    shortAnswerQs.map((q) =>
      gradeShortAnswerQuestion(
        q,
        (sceneAnswers[q.id] as string) ?? '',
        locale,
      ),
    ),
  );

  // Merge in original question order so callers can zip by index.
  const allResultsMap = new Map<string, QuestionResult>();
  for (const r of [...choiceResults, ...shortResults]) {
    allResultsMap.set(r.questionId, r);
  }
  return sceneQuestions
    .map((q) => allResultsMap.get(q.id))
    .filter((r): r is QuestionResult => Boolean(r));
}
```

- [ ] **Step 5: 跑测试确认绿**

Run: `cd frontend && npx vitest run components/scene-renderers/quiz-view.test.ts`
Expected: 5 个用例全部通过。

- [ ] **Step 6: 类型检查**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无新增错误（已有警告忽略）。

- [ ] **Step 7: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/components/scene-renderers/quiz-view.tsx frontend/components/scene-renderers/quiz-view.test.ts
git commit -m "feat(quiz): extract gradeSceneFully for cross-scene finalize auto-eval"
```

---

## Task 2: `handleFinalize` 对所有 scene 改用真实测评结果

**Files:**
- Modify: `frontend/components/scene-renderers/quiz-view.tsx` 的 `handleFinalize`（line 1416-1692）

- [ ] **Step 1: 在 handleFinalize 顶部把 `useI18n().locale` 解构出来**

在 `const handleFinalize = useCallback(async () => {` 紧贴的下一行（line 1417 之后）增加：

```ts
    const { locale } = useI18n();
```

> 实际位置：把 `useI18n` 在 `handleFinalize` 之前的组件顶部已经调用；直接复用 `locale` 变量即可。**先 grep 确认 `locale` 已在 quiz-view.tsx 顶层组件作用域。**

Run: 用 Grep 在 `frontend/components/scene-renderers/quiz-view.tsx` 搜 `const { locale } = useI18n|useI18n\(\)`。
Expected: 已有 `const { locale } = useI18n();` 在 useCallback 之外的组件顶部（如 line 1100 附近）。直接复用。

如果没找到，**STOP** 并报告 engineer 手动补一个顶层 `useI18n()` 调用（典型项目惯例，无需新 import）。

- [ ] **Step 2: 重写 handleFinalize 的 "1. 当前 scene 强制提交" 段**

把 line 1466-1497 整段替换为：

```ts
      // 1. Force-submit the current scene if it has local
      //    answers we haven't already pushed. This is the
      //    new Q3 behavior: always run the FULL grading
      //    (choice locally + short_answer via AI) — even
      //    for short_answer questions in a scene whose
      //    per-scene 提交答案 button the student never
      //    clicked. The previous implementation forced
      //    short_answer to `correct: false` and the
      //    student had to 重新答题 to recover the real
      //    score; with gradeSceneFully, the AI grading
      //    runs inline here as part of 交卷.
      if (currentHasAnswers && !alreadySentInThisPass.has(sceneId)) {
        const sceneAnswers = localAnswersByScene.get(sceneId)!;
        const sceneResults = await gradeSceneFully(
          sceneId,
          questions,
          sceneAnswers,
          locale,
        );
        const payload: ReportQuizPayload = {
          sceneId,
          totalQuestions: questions.length,
          answers: questions.map((q) => {
            const r = sceneResults.find((x) => x.questionId === q.id);
            return {
              questionId: q.id,
              choice: pickChoice(sceneAnswers[q.id]),
              correct: r ? r.status === 'correct' : false,
              ms: 0,
              points: q.points ?? 1,
            };
          }),
        };
        await cspProgress.reportQuizSubmit(payload);
        alreadySentInThisPass.add(sceneId);
        // Persist the freshly-computed results so a
        // subsequent 重新答题 / 退出 / 进入 路径能找到
        // them via readSubmittedState.
        writeSubmittedResults(sceneId, sceneResults);
      }
```

- [ ] **Step 3: 重写 "2. 其他 scene 强制提交" 段**

把 line 1499-1532 整段替换为：

```ts
      // 2. Force-submit every OTHER quiz scene that has
      //    local answers but hasn't been pushed yet.
      //    Same Q3 behavior: run gradeSceneFully so
      //    short_answer scenes get real AI grading
      //    instead of being silently marked wrong.
      for (const s of allScenes) {
        if (!s || !s.id) continue;
        if (s.id === sceneId) continue; // already handled above
        if (alreadySentInThisPass.has(s.id)) continue;
        const c = s.content;
        if (!c || c.type !== 'quiz') continue;
        const sceneAnswers = localAnswersByScene.get(s.id);
        if (!sceneAnswers || Object.keys(sceneAnswers).length === 0) continue;
        const sceneQuestions = c.questions;
        if (!Array.isArray(sceneQuestions) || sceneQuestions.length === 0) continue;

        const sceneResults = await gradeSceneFully(
          s.id,
          sceneQuestions,
          sceneAnswers,
          locale,
        );
        const payload: ReportQuizPayload = {
          sceneId: s.id,
          totalQuestions: sceneQuestions.length,
          answers: sceneQuestions.map((q) => {
            const r = sceneResults.find((x) => x.questionId === q.id);
            return {
              questionId: q.id,
              choice: pickChoice(sceneAnswers[q.id]),
              correct: r ? r.status === 'correct' : false,
              ms: 0,
              points: q.points ?? 1,
            };
          }),
        };
        await cspProgress.reportQuizSubmit(payload);
        alreadySentInThisPass.add(s.id);
        writeSubmittedResults(s.id, sceneResults);
      }
```

- [ ] **Step 4: 修 useCallback 依赖数组**

把 line 1692 的依赖：
```ts
  }, [isFullPaper, results, questions, sceneId, classroomId, answers, cspProgress]);
```
替换为：
```ts
  }, [
    isFullPaper,
    sceneId,
    classroomId,
    answers,
    questions,
    cspProgress,
    locale,
  ]);
```

> 注意 `results` 已从依赖里移除（不再在 handleFinalize 里用 `results.length > 0` 分支了；统一走 `gradeSceneFully`）。`questions` 保留因为步骤 2 的当前 scene payload 仍要用。

- [ ] **Step 5: 跑 quiz-view 已有单测 + 类型检查**

Run:
```bash
cd frontend
npx vitest run components/scene-renderers/quiz-view.test.ts
npx tsc --noEmit 2>&1 | head -30
```
Expected: 单测 5/5 通过；tsc 无新增错误。

- [ ] **Step 6: 手动跑 e2e（如果存在 csp-final-paper-submit.spec）**

Run: `cd frontend && npx playwright test e2e/tests/csp-final-paper-submit.spec.ts --reporter=line 2>&1 | tail -30`
Expected: 全部通过。如果环境里没起 docker compose，STOP 并报告 user 跑标准 deploy sequence 后再验。

- [ ] **Step 7: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/components/scene-renderers/quiz-view.tsx
git commit -m "feat(quiz): finalize auto-evaluates all scenes incl. short_answer AI grading"
```

---

## Task 3: 文档 + 记忆收尾

**Files:**
- Modify: `frontend/data/classrooms/cm_imp_cspj2025j_v1.json`（无需修改，本任务不动）
- Modify: `c:\Users\Administrator\.trae-cn\memory\projects\-d-AItrade-ai-math-mistake-machine--p2-19a76ff337c6de9d9375\project_memory.md`（追加规则）

- [ ] **Step 1: 更新 project memory**

在 `project_memory.md` 末尾追加（**不覆盖任何已有规则**）：

```markdown
- 交卷时（`handleFinalize` in quiz-view.tsx）所有 scene 走 `gradeSceneFully` 真实测评：选择题本地 grade + short_answer 调 `/api/quiz-grade` AI 评分；不再有"必须先逐个点提交答案"的前置条件
- `gradeSceneFully` 是 quiz-view.tsx 的 named export，fast path 优先复用 `quizResults:<sceneId>` 的 reviewing 缓存，避免重复 AI 调用
```

- [ ] **Step 2: 部署**

由 user 在服务器上跑标准 deploy sequence：

```bash
cd /home/ubuntu/studymate
git pull origin master
docker compose up -d --build frontend
```

- [ ] **Step 3: 浏览器手动验证 4 步**

1. 进 `cm_imp_cspj2016j_v1`，**只答完前 2 个 scene 后直接点"交卷"**（跳过第三、四、五个 scene 的"提交答案"）。
2. 弹窗里点"确认交卷"，等待出现总分页。
3. 检查总分页：breakdown 里"单项选择题 1"、"单项选择题 2"应该有真实得分（选择题本地 grade），"程序阅读题 1 / 2"显示 0/N（因为没答），"完善程序题"显示 0/N。
4. 退出页面，再回到 csp-lecture 卡片 → "查看上次总分" modal，应该显示和步骤 3 一致的总分。

Expected: 4 步全过；如果总分还是 0/N，回到 quiz-view.tsx 的 handleFinalize 检查 `gradeSceneFully` 是否被调用、`cspProgress.reportQuizSubmit` 的 payload 是否有真实 `correct: true`。

- [ ] **Step 4: Commit（如果是 memory-only 改动）**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add -A docs/superpowers/plans/2026-08-13-csp-final-paper-auto-eval.md
git commit -m "docs(plan): CSP 真题卷交卷自动全部测评 实施计划"
```

> 计划文件本身保留在仓库以便 reviewer 追溯。
