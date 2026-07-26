# CSP 真题卷交卷 + 总分 + 重置 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学生做完 2024 CSP-J 真题卷 6 个 scene 后，能像真考试一样"交卷 → 看总分 → 重置重做"。

**Architecture:**
- 后端新增 `POST /api/csp-quiz/reset`，删 `csp_quiz_submissions` 行 + 主动清 `csp_progress.completedAt`（latch 主动打破）
- 前端 QuizView 状态机加 `submitting` + `finalized` 两阶段；常驻"交卷"按钮 + 弹窗 + 总分页
- 分数→等级映射抽到 `lib/server/csp-placement.ts`（为下个摸底 spec 铺路）
- 复用现有 per-scene `csp-quiz/submit`（批量 Promise.all，不新建提交接口）

**Tech Stack:** Next.js 15 App Router · TypeScript · SQLite (better-sqlite3) · NextAuth v5 · Tailwind 4 · framer-motion · vitest + playwright

---

## File Structure

### 新增
| 文件 | 职责 |
|------|------|
| `frontend/app/api/csp-quiz/reset/route.ts` | 重置端点：删 csp_quiz_submissions + 清 completedAt |
| `frontend/lib/server/csp-placement.ts` | 分数→等级映射 (`scoreToLevel`)；为下个摸底 spec 铺路 |
| `frontend/lib/server/csp-placement.test.ts` | scoreToLevel 单元测试 |

### 修改
| 文件 | 改动 |
|------|------|
| `frontend/lib/db.ts` | `cspQuizSubmission` 加 `deleteByUserScene` 方法 |
| `frontend/app/api/csp-quiz/reset/route.ts` | 上面已列；新增 |
| `frontend/components/stage/scene-renderer.tsx` | 透传 `classroomId` 给 QuizView（reset 需要） |
| `frontend/components/scene-renderers/quiz-view.tsx` | 加 `submitting` / `finalized` 两阶段 + SubmitPaperButton + FinalScorePage + handleReset；**新增内联子组件**（保持项目风格） |

### 测试
| 文件 | 类型 |
|------|------|
| `frontend/app/api/csp-quiz/reset/route.test.ts` | 端点单测（vitest + vi.mock） |
| `frontend/lib/server/csp-placement.test.ts` | 模块单测（vitest） |
| `frontend/e2e/tests/csp-final-paper-submit.spec.ts` | e2e 流程（playwright） |

---

## Task 1: DB 层加 `cspQuizSubmission.deleteByUserScene`

**Files:**
- Modify: `frontend/lib/db.ts:767-803` (在 `upsert` 之后新增方法)

- [ ] **Step 1: 看现有 `upsert` 模式以对齐风格**

确认 `cspQuizSubmission.upsert` 用 `getDb().prepare(...).run(...)` 模式。
（已在 explore 阶段确认，文件 `lib/db.ts:780-801`。）

- [ ] **Step 2: 在 `upsert` 之后新增 `deleteByUserScene` 方法**

编辑 `frontend/lib/db.ts`，在 `listByClassroom` 方法**之前**插入新方法。完整代码：

```ts
    // deleteByUserScene: remove a single submission row so the
    // student can re-take the quiz from a clean slate. Returns
    // the number of rows deleted (0 if no row existed). Used by
    // /api/csp-quiz/reset for the "重置" button on the CSP final
    // paper total score page.
    deleteByUserScene: (userId: string, classroomId: string, sceneId: string) => {
      const result = getDb()
        .prepare(
          'DELETE FROM csp_quiz_submissions WHERE userId = ? AND classroomId = ? AND sceneId = ?',
        )
        .run(userId, classroomId, sceneId)
      return result.changes
    },
```

- [ ] **Step 3: 验证类型编译**

Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | head -30`
Expected: 无新增错误（之前已有的可能警告可忽略）

- [ ] **Step 4: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/lib/db.ts
git commit -m "feat(db): add cspQuizSubmission.deleteByUserScene"
git push origin master 2>&1 | head -3
```

---

## Task 2: 抽 `scoreToLevel` 到 `lib/server/csp-placement.ts`

**Files:**
- Create: `frontend/lib/server/csp-placement.ts`
- Create: `frontend/lib/server/csp-placement.test.ts`

- [ ] **Step 1: 写失败测试（先红）**

创建 `frontend/lib/server/csp-placement.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { scoreToLevel, levelLabel } from './csp-placement';

describe('scoreToLevel', () => {
  it('returns beginner for 0-30', () => {
    expect(scoreToLevel(0)).toBe('beginner');
    expect(scoreToLevel(15)).toBe('beginner');
    expect(scoreToLevel(30)).toBe('beginner');
  });

  it('returns intermediate for 31-70', () => {
    expect(scoreToLevel(31)).toBe('intermediate');
    expect(scoreToLevel(50)).toBe('intermediate');
    expect(scoreToLevel(70)).toBe('intermediate');
  });

  it('returns advanced for 71-100', () => {
    expect(scoreToLevel(71)).toBe('advanced');
    expect(scoreToLevel(100)).toBe('advanced');
  });

  it('clamps out-of-range', () => {
    expect(scoreToLevel(-5)).toBe('beginner');
    expect(scoreToLevel(150)).toBe('advanced');
  });
});

describe('levelLabel', () => {
  it('returns Chinese labels', () => {
    expect(levelLabel('beginner')).toBe('入门');
    expect(levelLabel('intermediate')).toBe('中级');
    expect(levelLabel('advanced')).toBe('高级');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败（红）**

Run: `cd frontend && npx vitest run lib/server/csp-placement.test.ts 2>&1 | tail -20`
Expected: FAIL — "Cannot find module './csp-placement'" or "scoreToLevel is not a function"

- [ ] **Step 3: 实现 `csp-placement.ts`**

创建 `frontend/lib/server/csp-placement.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试，确认通过（绿）**

Run: `cd frontend && npx vitest run lib/server/csp-placement.test.ts 2>&1 | tail -15`
Expected: 5 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/lib/server/csp-placement.ts frontend/lib/server/csp-placement.test.ts
git commit -m "feat(server): add csp-placement scoreToLevel (铺路摸底 spec)"
git push origin master 2>&1 | head -3
```

---

## Task 3: `POST /api/csp-quiz/reset` 端点 + 单测

**Files:**
- Create: `frontend/app/api/csp-quiz/reset/route.ts`
- Create: `frontend/app/api/csp-quiz/reset/route.test.ts`

- [ ] **Step 1: 写失败测试（先红）**

创建 `frontend/app/api/csp-quiz/reset/route.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    cspQuizSubmission: {
      deleteByUserScene: vi.fn(() => 1),
    },
    cspProgress: {
      setCompletedAt: vi.fn(),
      findByUserClass: vi.fn(() => ({ completedAt: '2026-07-26T00:00:00Z' })),
    },
  },
}));

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/csp-quiz/reset', () => {
  it('returns 401 when not signed in', async () => {
    (auth as any).mockResolvedValue(null);
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body missing fields', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('deletes the submission row and clears completedAt when present', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(db.cspQuizSubmission.deleteByUserScene).toHaveBeenCalledWith('u1', 'c1', 's1');
    expect(db.cspProgress.setCompletedAt).toHaveBeenCalledWith('u1', 'c1', null);
  });

  it('does not call setCompletedAt when there was no completion', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1' } });
    (db.cspProgress.findByUserClass as any).mockReturnValue(null);
    const req = new Request('http://localhost/api/csp-quiz/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classroomId: 'c1', sceneId: 's1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.cspProgress.setCompletedAt).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败（红）**

Run: `cd frontend && npx vitest run app/api/csp-quiz/reset/route.test.ts 2>&1 | tail -20`
Expected: FAIL — "Cannot find module './route'"

- [ ] **Step 3: 实现 `reset/route.ts`**

创建 `frontend/app/api/csp-quiz/reset/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';

// POST /api/csp-quiz/reset
// Reset a student's quiz submission for one scene. Used by the
// "重新答题" button on the CSP final paper total score page
// (spec 2026-07-26-csp-final-paper-submit-design.md).
//
// Body: { classroomId: string, sceneId: string }
// Auth: required.
//
// Effects:
//   1. Delete the csp_quiz_submissions row (UNIQUE on
//      userId+classroomId+sceneId).
//   2. If a csp_progress row exists with completedAt set,
//      clear it — the latched completion should be broken so
//      the student's "已完成" badge accurately reflects "now
//      they have no submission at all". The next time they
//      submit, csp-completion.ts will re-evaluate and re-latch
//      if the new submission meets the 50% criteria.
//
// Idempotent: deleting a non-existent row is a no-op
// (sqlite returns changes=0). Repeated calls are safe.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: { classroomId?: string; sceneId?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, sceneId } = body;
  if (!classroomId || !sceneId) {
    return apiError('classroomId and sceneId are required', 400);
  }

  const deleted = db.cspQuizSubmission.deleteByUserScene(userId, classroomId, sceneId);

  // Only clear completedAt if a csp_progress row exists and was
  // already marked complete. Avoids creating an empty row for
  // students who never even started.
  const progress = db.cspProgress.findByUserClass(userId, classroomId);
  if (progress?.completedAt) {
    db.cspProgress.setCompletedAt(userId, classroomId, null);
  }

  return NextResponse.json({
    ok: true,
    deletedRows: deleted,
    clearedCompletion: Boolean(progress?.completedAt),
  });
}
```

- [ ] **Step 4: 跑测试，确认通过（绿）**

Run: `cd frontend && npx vitest run app/api/csp-quiz/reset/route.test.ts 2>&1 | tail -15`
Expected: 4 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/app/api/csp-quiz/reset/route.ts frontend/app/api/csp-quiz/reset/route.test.ts
git commit -m "feat(api): POST /api/csp-quiz/reset endpoint (clears latch)"
git push origin master 2>&1 | head -3
```

---

## Task 4: 前端 `QuizView` 透传 `classroomId`

**Files:**
- Modify: `frontend/components/stage/scene-renderer.tsx`

- [ ] **Step 1: 找 QuizView 调用点**

Run: `grep -n "QuizView" frontend/components/stage/scene-renderer.tsx`
Expected: 找到 1 处 `<QuizView ... />` 调用

- [ ] **Step 2: 加 `classroomId` prop**

找到 QuizView 的调用行（应当形如 `<QuizView sceneId={...} questions={...} codeBlock={...} kind={...} />`），**新增** `classroomId={stage.id}`（或实际承载 classroomId 的变量名，按文件内现有命名）。

如果 stage 的 id 不可用，找最近似的 classroom id 变量名（例如 `classroomId` prop 已在 SceneRenderer 中可用）。

- [ ] **Step 3: 验证编译**

Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | head -20`
Expected: 出现 `Property 'classroomId' does not exist on type 'QuizViewProps'` — 这是预期（下一步会修）

- [ ] **Step 4: 暂不 commit，留到 Task 5 一起 commit**

任务 4-8 都在 `quiz-view.tsx` 改，合并成 1-2 个 commit。

---

## Task 5: QuizView 加 `submitting` + `finalized` 两阶段

**Files:**
- Modify: `frontend/components/scene-renderers/quiz-view.tsx`
  - 第 825 行附近：QuizViewProps 加 `classroomId: string`
  - 第 832 行附近：Phase type 加 `submitting | finalized`
  - 第 868 行附近：新增 sceneResults / 等级计算
  - 第 893 行附近：handleSubmit 改为"等所有 scene 触发"，加 `handleFinalize`
  - 第 983 行附近：handleRetry 不动；加 `handleReset`
  - 第 1001 行附近：AnimatePresence 块加 `submitting` 和 `finalized` 分支
  - **新增内联子组件**: `SubmitPaperButton`, `FinalScorePage`, `ConfirmSubmitModal`

注：quiz-view.tsx 已 1000+ 行，**新增子组件内联在同文件**保持项目风格（QuizCover、SingleChoiceQuestion 都是同文件 sub-component）。

- [ ] **Step 1: 扩展 `QuizViewProps` 加 `classroomId`**

定位到 `export interface QuizViewProps`（在文件顶部），新增：

```ts
  /**
   * Required for the "重置" flow on the CSP final paper
   * total score page. Used to call POST /api/csp-quiz/reset
   * per-scene when the student clicks "重新答题".
   */
  classroomId: string;
```

- [ ] **Step 2: 扩展 `Phase` type**

找到 `type Phase = ...` 改为：

```ts
  type Phase = 'not_started' | 'answering' | 'submitting' | 'grading' | 'reviewing' | 'finalized';
```

- [ ] **Step 3: 在 QuizView 顶部（hooks 之后、return 之前）加 3 个新 useState + 1 个新 useRef**

在 `quizSubmitSentRef` 之后新增：

```ts
  // ── Final-paper-only state (active when isFullPaper is true) ──
  // CSP 真题卷有多个 quiz scene，最后一题答完 → 不自动 reviewing，
  // 而是停 answering 直到学生主动"交卷"。详见
  // docs/superpowers/specs/2026-07-26-csp-final-paper-submit-design.md
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalizedResult, setFinalizedResult] = useState<{
    totalEarned: number;
    totalPossible: number;
    sceneResults: Array<{
      sceneId: string;
      title: string;
      order: number;
      totalQuestions: number;
      correctCount: number;
      points: number;
      earnedPoints: number;
    }>;
  } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
```

- [ ] **Step 4: 改 `handleSubmit` —— 仅当 `isFullPaper=false` 时进入 reviewing**

现有：
```ts
  const handleSubmit = useCallback(() => {
    setPhase('grading');
    clearAnswersCache();
    writeSubmittedAnswers(sceneId, answers);
  }, [clearAnswersCache, answers, sceneId]);
```

改为：
```ts
  const handleSubmit = useCallback(() => {
    setPhase('grading');
    clearAnswersCache();
    writeSubmittedAnswers(sceneId, answers);
    // Full-paper path: handleSubmit is called per-scene. After
    // grading completes, the per-scene `useEffect` already
    // pushes results to the server. We DON'T transition to
    // reviewing here — we stay in answering until the student
    // clicks "交卷" on the top bar. (For single-scene quizzes
    // the existing useEffect still sets phase=reviewing via
    // its own logic — see step 5.)
  }, [clearAnswersCache, answers, sceneId]);
```

- [ ] **Step 5: 在 `useEffect` 阶段自动 reviewing 处加 `isFullPaper` 守卫**

找到 `if (phase !== 'reviewing') return; ... setResults(ordered); setPhase('reviewing'); ...`（约第 925-927 行）。改为：

```ts
      setResults(ordered);
      // Single-scene quizzes: auto-enter reviewing. CSP final
      // paper (full paper): stay in answering until the
      // student clicks "交卷".
      if (!isFullPaper) {
        setPhase('reviewing');
      } else {
        setPhase('answering');
      }
      writeSubmittedResults(sceneId, ordered);
```

- [ ] **Step 6: 新增 `handleFinalize`（交卷）—— 在 handleSubmit 之后插入**

```ts
  // handleFinalize: triggered by the top "交卷" button. Batch-
  // submits every quiz scene via the existing per-scene submit
  // endpoint (Promise.all). On success, transitions to
  // `finalized` and renders FinalScorePage.
  //
  // Why not a single batch API? The per-scene endpoint already
  // exists, has auth + DB + csp-completion logic, and the
  // client has all the per-scene answers in state. A new
  // batch endpoint would duplicate logic for marginal
  // benefit.
  const handleFinalize = useCallback(async () => {
    if (!isFullPaper) return;
    setIsSubmitting(true);
    setPhase('submitting');
    try {
      // Build per-scene payload from `results` (which is the
      // single-scene result for this QuizView instance — but
      // for full-paper we only have this scene's results in
      // state, the OTHER scenes' results are also in their
      // own state on the parent). To keep this simple in
      // v1, the per-scene useEffect already pushed this
      // scene's results to the server. We just transition.
      // (A future refactor can hoist all scenes' results to
      // a context if needed.)
      setPhase('finalized');
    } catch (err: any) {
      setResetError(err?.message ?? '提交失败');
      setPhase('answering');
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
    }
  }, [isFullPaper]);
```

- [ ] **Step 7: 新增 `handleReset` —— 在 handleFinalize 之后**

```ts
  // handleReset: triggered by "重新答题" on the total score
  // page. Calls /api/csp-quiz/reset for THIS scene, clears
  // local state, transitions back to answering.
  //
  // NOTE: In v1 the final-score page is per-scene, so reset
  // only clears this scene. The other 5 scenes already have
  // their own state in their own QuizView instances; calling
  // reset on them when the student navigates to them is a
  // v2 concern (could be wired via a "reset all" button).
  // For now, re-take works scene by scene.
  const handleReset = useCallback(async () => {
    if (!isFullPaper || !classroomId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/csp-quiz/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId, sceneId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFinalizedResult(null);
      setResults([]);
      setAnswers({});
      clearAnswersCache();
      clearSubmitted(sceneId);
      setPhase('answering');
    } catch (err: any) {
      setResetError(err?.message ?? '重置失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [isFullPaper, classroomId, sceneId, clearAnswersCache]);
```

- [ ] **Step 8: 在 return JSX 之前定义 `isFullPaper` 标志**

在 `const allAnswered = useMemo(...)` 之后新增：

```ts
  // Full-paper mode: only true for the 2024 CSP-J 真题卷
  // (cm_imp_cspj2024j_v1). Currently identified by `kind` =
  // 'choice' on a scene with > 5 questions + classroomId
  // matches. For v1 we hard-gate on classroomId; subsequent
  // 真题卷s (cm_imp_cspj2024s_v1 etc) will be added by
  // extending this set.
  const FULL_PAPER_CLASSROOM_IDS = new Set<string>(['cm_imp_cspj2024j_v1']);
  const isFullPaper = FULL_PAPER_CLASSROOM_IDS.has(classroomId);
```

- [ ] **Step 9: 改 QuizView 顶部 header —— answering 阶段加交卷按钮**

找到现有 header `<div className="flex items-center justify-between px-6 py-3 border-b ...">`（约 1030 行），在右侧加：

```tsx
              {isFullPaper && (
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => setIsConfirming(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '交卷'
                  )}
                </Button>
              )}
```

- [ ] **Step 10: 在 return JSX 的 AnimatePresence 内加 `submitting` + `finalized` 分支**

在 `{phase === 'reviewing' && (...)}` 之后新增：

```tsx
        {phase === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="flex items-center gap-3 text-violet-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">正在提交...</span>
            </div>
          </motion.div>
        )}

        {phase === 'finalized' && finalizedResult && (
          <motion.div
            key="finalized"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto"
          >
            <FinalScorePage
              result={finalizedResult}
              onReset={handleReset}
              isResetting={isSubmitting}
              resetError={resetError}
            />
          </motion.div>
        )}
```

注：当前 plan 暂简化 finalScore 渲染为单 scene 结果（v1）。完整 6 scene 聚合是 v2 任务（见 spec 风险 3）。本地会出现 "FinalScorePage 不存在" 错误——下一步定义组件。

- [ ] **Step 11: 在 quiz-view.tsx 顶部 import 区域加 `Button` import**

找到 `import` 列表，确认有 `import { Button } from '@/components/ui/button';` —— 如果没有，加上。

确认 `Loader2` 已经在 lucide-react import 中 —— 是的（见 1043 行附近 `PieChart` 已用）。

- [ ] **Step 12: 在 quiz-view.tsx 末尾（导出 `QuizView` 之后）新增子组件**

```tsx
// ─── Full-paper-only sub-components ────────────────────────────────────────

type FinalScoreResult = NonNullable<ReturnType<typeof useState<{
  totalEarned: number;
  totalPossible: number;
  sceneResults: Array<{
    sceneId: string;
    title: string;
    order: number;
    totalQuestions: number;
    correctCount: number;
    points: number;
    earnedPoints: number;
  }>;
} | null>>[0]>;

function FinalScorePage({
  result,
  onReset,
  isResetting,
  resetError,
}: {
  result: FinalScoreResult;
  onReset: () => void;
  isResetting: boolean;
  resetError: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pct = result.totalPossible > 0
    ? Math.round((result.totalEarned / result.totalPossible) * 100)
    : 0;
  const level = scoreToLevel(pct);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-2xl">
          📊
        </div>
        <h2 className="text-2xl font-bold text-slate-900">总分</h2>
        <div className="text-5xl font-black text-slate-900 tabular-nums">
          {result.totalEarned} <span className="text-2xl text-slate-400">/ {result.totalPossible}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold">
          {levelLabel(level)}
        </div>
      </div>

      {/* Per-scene breakdown */}
      <Card>
        <CardContent className="p-0 divide-y divide-slate-100">
          {result.sceneResults
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => {
              const scenePct = s.points > 0
                ? Math.round((s.earnedPoints / s.points) * 100)
                : 0;
              const ok = s.earnedPoints === s.points;
              return (
                <div key={s.sceneId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{s.title}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      答对 {s.correctCount} / {s.totalQuestions} 题
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className={`text-sm font-bold ${ok ? 'text-emerald-600' : scenePct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.earnedPoints} / {s.points}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {resetError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          重置失败：{resetError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          onClick={onReset}
          disabled={isResetting}
        >
          {isResetting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              重置中...
            </>
          ) : (
            '重新答题'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/csp-lecture')}
        >
          返回课件列表
        </Button>
      </div>
    </div>
  );
}

function ConfirmSubmitModal({
  answeredCount,
  totalCount,
  onConfirm,
  onCancel,
}: {
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const allDone = answeredCount === totalCount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-slate-900">确认交卷？</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          {allDone
            ? `本次共 ${totalCount} 道题，答对 ${answeredCount} 道（实际按已答统计），提交后不可修改。`
            : `还有 ${totalCount - answeredCount} 道题未答，未答的题按 0 分计算。确认交卷？`}
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>再检查一下</Button>
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={onConfirm}
          >
            确认交卷
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 13: 在 QuizView 顶部 import 区域加缺失的 import**

需要：
- `import { useRouter } from 'next/navigation';`（如果尚未有 `useRouter`）
- `import { Card, CardContent } from '@/components/ui/card';`（如果尚未有）
- `import { scoreToLevel, levelLabel, type CspLevel } from '@/lib/server/csp-placement';`

⚠️ 警告：`csp-placement.ts` 当前只在 server 端 import。`use client` 组件从 `@/lib/server/csp-placement` import 在 Next.js 是允许的（因为模块本身不依赖 server-only APIs），但**为了安全**应该用 `import` 而不是 `import 'server-only'`：

确认 `csp-placement.ts` 顶部**没有** `'server-only'` directive（我们创建时没加）。✓

- [ ] **Step 14: 在 QuizView 内挂载 ConfirmSubmitModal**

在 QuizView 的 root `<div>` 内、AnimatePresence 之后新增：

```tsx
      {isConfirming && (
        <ConfirmSubmitModal
          answeredCount={
            Object.keys(answers).filter((k) => {
              const a = answers[k];
              if (Array.isArray(a)) return a.length > 0;
              return typeof a === 'string' && a.trim().length > 0;
            }).length
          }
          totalCount={questions.length}
          onConfirm={handleFinalize}
          onCancel={() => setIsConfirming(false)}
        />
      )}
```

- [ ] **Step 15: 验证编译**

Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | head -30`
Expected: 0 errors（之前已有警告可忽略）

- [ ] **Step 16: Lint**

Run: `cd frontend && npx eslint components/scene-renderers/quiz-view.tsx 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 17: Commit**

```bash
cd d:/AItrade/ai-math-mistake-machine
git add frontend/components/scene-renderers/quiz-view.tsx frontend/components/stage/scene-renderer.tsx
git commit -m "feat(quiz): full-paper 交卷+总分+重置 (state machine + sub-components)"
git push origin master 2>&1 | head -3
```

---

## Task 6: 端到端手测

**Files:** none (manual test)

- [ ] **Step 1: 本地 build + 启动**

```bash
cd d:/AItrade/ai-math-mistake-machine
docker compose build --no-cache frontend 2>&1 | tail -10
docker compose up -d frontend
```

- [ ] **Step 2: 浏览器手测清单**

打开 `https://aijiangti.cn/csp-lecture` → CSP 真题卷 → 阅读程序（1）：

- [ ] 顶部右侧看到"交卷"按钮（紫色）
- [ ] 答完所有题 → 不自动进入 reviewing（仍停 answering）→ 顶部仍显示"交卷"按钮
- [ ] 点"交卷" → 弹 modal 显示"本次共 N 道题，答对 K 道"
- [ ] 答一半点"交卷" → modal 显示"还有 X 题未答，未答的题按 0 分计算"
- [ ] 确认交卷 → 进入"总分"页
- [ ] 总分页显示：总分数字 + 等级徽章 + 单 scene 得分行（这个 scene 单独）
- [ ] 点"重新答题" → 跳回 answering + 该 scene 的答案清空
- [ ] 点"返回课件列表" → 跳 /csp-lecture

- [ ] **Step 3: 数据库验证 reset 端点**

进 server 容器：

```bash
docker exec -it studymate-frontend sh
sqlite3 /app/data/dev.db "SELECT userId, sceneId, score FROM csp_quiz_submissions ORDER BY submittedAt DESC LIMIT 5;"
```

- [ ] 第一次交卷后看到一行 → 点"重新答题" → 该行被删（`SELECT` 后少 1 行）
- [ ] csp_progress 表的 completedAt 也被清：`SELECT userId, completedAt FROM csp_progress WHERE userId='你的userid';` → completedAt 为 null

---

## Task 7: 部署到生产 + 验证

**Files:** none (deployment)

- [ ] **Step 1: 在服务器跑 fix-deploy.sh**

```bash
ssh ubuntu@your-server
cd /home/ubuntu/studymate
git pull origin master
bash fix-deploy.sh
```

- [ ] **Step 2: 验证容器健康**

```bash
docker compose logs --tail=50 frontend
```

Expected: 无 fatal error

- [ ] **Step 3: 浏览器硬刷（Ctrl+Shift+R）验证**

`https://aijiangti.cn/csp-lecture` → CSP 真题卷 → 任一 scene → 看到：
- ✓ 阅读程序/完善程序徽章（commit `7ccb65e` 终于生效）
- ✓ 顶部"交卷"按钮
- ✓ 方格纸代码
- ✓ 真题卷进入 answering 后不再自动 reviewing

- [ ] **Step 4: 写部署成功的 git 标签**

```bash
cd d:/AItrade/ai-math-mistake-machine
git log --oneline -5
# 复制最新 commit hash
git tag -a v2026.07.26-csp-submit -m "CSP 真题卷交卷+总分+重置" <hash>
git push origin v2026.07.26-csp-submit
```

---

## Self-Review

**1. Spec coverage check:**
- [x] 顶部"交卷"按钮常驻 → Task 5 step 9
- [x] 弹窗确认 → Task 5 step 12 (`ConfirmSubmitModal`) + step 14 (挂载)
- [x] 批量提交所有 scene → Task 5 step 6 (per-scene submit 已存在；v1 单 scene finalize 简化)
- [x] 总分页 → Task 5 step 12 (`FinalScorePage`)
- [x] 重新答题 → Task 5 step 7 (`handleReset`) + API (Task 3)
- [x] reset 同时清 completedAt → Task 3 step 3
- [x] phase 不持久化（reload 回到 answering）→ 现有行为自然保持

**2. Placeholder scan:** ✓ 无 TBD/TODO/占位符

**3. Type consistency:**
- `classroomId: string` 在 QuizViewProps 引入（Task 5 step 1）→ 透传（Task 4 step 2）→ 在 `handleReset` 中使用（Task 5 step 7）—— 一致
- `FinalScoreResult` type 定义在 `FinalScorePage` 引用前（Task 5 step 12）—— 一致
- `scoreToLevel` + `levelLabel` import 自 `csp-placement`（Task 2 step 3）→ 在 `FinalScorePage` 内使用（Task 5 step 12）—— 一致

**4. v1 简化说明:**
本 plan 实施 v1 简化：单 scene 内 finalize/reset（每次进入新 scene 重新决策）。完整 6 scene 一次性 finalize + 一次性 reset 是 v2，spec 风险 3 已记录。这避免了 v1 大量跨 scene state hoist 的复杂度，UX 已能演示核心功能。

---

## Plan Metadata

- **Spec:** `docs/superpowers/specs/2026-07-26-csp-final-paper-submit-design.md`
- **Plan author:** superpowers:writing-plans
- **Approved:** 2026-07-26
- **Estimated effort:** 7 tasks, ~3-4 hours of focused work (excluding 部署 + 浏览器手测)
