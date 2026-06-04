# Homework Entry Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the student-facing mistake flow into the homework-entry experience on `/mistake`, while reusing the existing `generation-preview -> classroom` runtime and adding lightweight quiz/history/parent surfaces.

**Architecture:** Keep the existing generation and playback pipeline intact, but add a student-facing shell around it. The work splits into route-shell changes (`/mistake`, `/mistake/recognize`, `/quiz`, `/quiz-result`, `/history`, `/parent`), a lightweight view-model layer for explanation summaries and homework session data, and isolated i18n additions under a dedicated homework namespace.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, local JSON-backed mistake sessions, i18next JSON locales, Vitest.

---

### Task 1: Introduce Homework i18n Namespace And View Models

**Files:**
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\types.ts`
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\content.ts`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\lib\i18n\locales\zh-CN.json`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\homework-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { getHomeworkHomeContent } from '@/lib/mistake/ui/content';

describe('getHomeworkHomeContent', () => {
  it('returns the homework-entry copy contract for the mistake home page', () => {
    const content = getHomeworkHomeContent((key: string) => key);

    expect(content).toEqual({
      title: 'homeworkHome.title',
      subtitle: 'homeworkHome.subtitle',
      ctaPrimary: 'homeworkHome.ctaPrimary',
      ctaSecondary: 'homeworkHome.ctaSecondary',
      sceneHint: 'homeworkHome.sceneHint',
      values: [
        'homeworkHome.value1',
        'homeworkHome.value2',
        'homeworkHome.value3',
      ],
      uploadHint: 'homeworkHome.uploadHint',
      uploadTip: 'homeworkHome.uploadTip',
      parentHint: 'homeworkHome.parentHint',
      emptyTitle: 'homeworkHome.emptyTitle',
      emptyDesc: 'homeworkHome.emptyDesc',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/mistake/homework-content.test.ts`
Expected: FAIL with `Cannot find module '@/lib/mistake/ui/content'` or missing export errors.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/ui/types.ts
export type HomeworkHomeViewModel = {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  sceneHint: string;
  values: string[];
  uploadHint: string;
  uploadTip: string;
  parentHint: string;
  emptyTitle: string;
  emptyDesc: string;
};

export type ExplanationSummary = {
  stuckPoint: string;
  whyStuck: string;
  howToThink: string;
  nextTimeTip: string;
  simplifiedExplanation?: {
    title: string;
    desc1: string;
    desc2: string;
  };
};

export type HomeworkHistoryStatus = 'pending' | 'done';
```

```ts
// lib/mistake/ui/content.ts
import type { HomeworkHomeViewModel } from './types';

export function getHomeworkHomeContent(t: (key: string) => string): HomeworkHomeViewModel {
  return {
    title: t('homeworkHome.title'),
    subtitle: t('homeworkHome.subtitle'),
    ctaPrimary: t('homeworkHome.ctaPrimary'),
    ctaSecondary: t('homeworkHome.ctaSecondary'),
    sceneHint: t('homeworkHome.sceneHint'),
    values: [
      t('homeworkHome.value1'),
      t('homeworkHome.value2'),
      t('homeworkHome.value3'),
    ],
    uploadHint: t('homeworkHome.uploadHint'),
    uploadTip: t('homeworkHome.uploadTip'),
    parentHint: t('homeworkHome.parentHint'),
    emptyTitle: t('homeworkHome.emptyTitle'),
    emptyDesc: t('homeworkHome.emptyDesc'),
  };
}
```

```json
// zh-CN.json (additive keys only)
{
  "homeworkHome": {
    "title": "作业不会做，拍一下马上讲明白",
    "subtitle": "不会直接只给答案，会一步一步讲清楚这题该怎么想。",
    "ctaPrimary": "拍一道作业题",
    "ctaSecondary": "看看今天做过的题",
    "sceneHint": "适合小学数学作业卡题场景",
    "value1": "先讲思路，再看会不会做",
    "value2": "讲完再练 1 题，确认真的学会",
    "value3": "做过的题会自动帮你记住",
    "uploadHint": "支持拍作业、练习册、试卷上的单道数学题",
    "uploadTip": "尽量一次只拍一道题，讲解更准确",
    "parentHint": "给家长看的不是“讲了多少”，而是“这类题会了没有”。",
    "emptyTitle": "还没有做过的题",
    "emptyDesc": "拍一道题开始试试，先解决今天作业里卡住的一题。"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/mistake/homework-content.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/mistake/homework-content.test.ts lib/mistake/ui/types.ts lib/mistake/ui/content.ts lib/i18n/locales/zh-CN.json
git commit -m "feat: add homework entry content models"
```

### Task 2: Split `/mistake` Into Home And Recognize Screens

**Files:**
- Modify: `d:\AItrade\AI-MATH-MISTAKE\app\mistake\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\app\mistake\recognize\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\recognize-session.ts`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\recognize-session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import {
  clearPendingRecognizeSession,
  readPendingRecognizeSession,
  writePendingRecognizeSession,
} from '@/lib/mistake/ui/recognize-session';

describe('recognize-session storage', () => {
  it('round-trips the OCR confirmation payload through sessionStorage', () => {
    const payload = {
      imageUrl: 'blob:test',
      problemText: '12 ÷ 3 = ?',
      studentAnswer: '5',
      correctAnswerCandidate: '4',
      confidence: 0.72,
      needsUserConfirmation: true,
    };

    writePendingRecognizeSession(payload);
    expect(readPendingRecognizeSession()).toEqual(payload);

    clearPendingRecognizeSession();
    expect(readPendingRecognizeSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/mistake/recognize-session.test.ts`
Expected: FAIL because `recognize-session.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/ui/recognize-session.ts
const STORAGE_KEY = 'pendingRecognizeSession';

export type PendingRecognizeSession = {
  imageUrl: string;
  problemText: string;
  studentAnswer?: string;
  correctAnswerCandidate?: string;
  confidence: number;
  needsUserConfirmation: boolean;
};

export function writePendingRecognizeSession(payload: PendingRecognizeSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingRecognizeSession(): PendingRecognizeSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingRecognizeSession) : null;
}

export function clearPendingRecognizeSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}
```

```tsx
// app/mistake/page.tsx (directional changes)
// 1. Render the homework-entry shell instead of the current raw form.
// 2. After OCR success and `!shouldSkipConfirmation`, persist the confirmation payload
//    through `writePendingRecognizeSession()` and route to `/mistake/recognize`.
// 3. Keep the direct-to-preview fast path when confidence allows skipping confirmation.
```

```tsx
// app/mistake/recognize/page.tsx
// 1. Read the pending recognize payload from sessionStorage.
// 2. Show the recognized fields in editable controls.
// 3. On confirm, call the existing `createMistakeSession -> buildMistakeGenerationSession -> router.push('/generation-preview')` flow.
// 4. On retry, clear pending state and route back to `/mistake`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/mistake/recognize-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/mistake/recognize-session.test.ts app/mistake/page.tsx app/mistake/recognize/page.tsx lib/mistake/ui/recognize-session.ts
git commit -m "feat: add recognize confirmation route"
```

### Task 3: Add Homework Summary Fields To Mistake Sessions

**Files:**
- Modify: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\session\types.ts`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\session\store.ts`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\app\api\mistake\session\[id]\route.ts`
- Test: `d:\AItrade\AI-MATH-MISTAKE\app\api\mistake\session\[id]\route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { updateMistakeSession } from '@/lib/mistake/session/store';

describe('mistake session summary patch', () => {
  it('persists explanation and parent summary fields via patch updates', async () => {
    const created = await createMistakeSession({
      source: 'photo',
      ocr: { problemText: '12 ÷ 3 = ?' },
      confirmed: { problemText: '12 ÷ 3 = ?' },
      status: 'draft',
    });

    const updated = await updateMistakeSession(created.id, {
      explanationSummary: {
        stuckPoint: '数量关系没找对',
        whyStuck: '没有先找总数和每份数',
        howToThink: '先看总数，再看分成几份',
        nextTimeTip: '先找关键关系再列式',
      },
      parentSummary: {
        totalCount: 1,
        solvedCount: 0,
        needMoreReason: '数量关系还不稳',
        focusTopic: '除法应用题',
      },
    });

    expect(updated.explanationSummary?.stuckPoint).toBe('数量关系没找对');
    expect(updated.parentSummary?.focusTopic).toBe('除法应用题');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test app/api/mistake/session/[id]/route.test.ts`
Expected: FAIL with type errors or missing properties on `MistakeSession`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/session/types.ts
import type { ExplanationSummary } from '@/lib/mistake/ui/types';

export interface ParentSummary {
  totalCount: number;
  solvedCount: number;
  needMoreReason: string;
  focusTopic: string;
}

export interface MistakeSession {
  // existing fields...
  explanationSummary?: ExplanationSummary;
  parentSummary?: ParentSummary;
  masteryStatus?: 'pending' | 'done';
}
```

```ts
// store.ts / route.ts
// Permit these additive fields in PATCH payloads without changing the current draft/live/completed flow.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test app/api/mistake/session/[id]/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/mistake/session/types.ts lib/mistake/session/store.ts app/api/mistake/session/[id]/route.ts app/api/mistake/session/[id]/route.test.ts
git commit -m "feat: persist homework explanation summaries"
```

### Task 4: Wrap Classroom In Homework Result Shell

**Files:**
- Create: `d:\AItrade\AI-MATH-MISTAKE\components\mistake\homework-result-shell.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\build-explanation-summary.ts`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\app\classroom\[id]\page.tsx`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\build-explanation-summary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { buildFallbackExplanationSummary } from '@/lib/mistake/ui/build-explanation-summary';

describe('buildFallbackExplanationSummary', () => {
  it('creates four fixed cards from a plain explanation payload', () => {
    const summary = buildFallbackExplanationSummary({
      problemText: '一根绳子长 2 米，剪去 80 厘米，还剩多少厘米？',
      studentAnswer: '120 厘米',
    });

    expect(summary.stuckPoint).toBeTruthy();
    expect(summary.whyStuck).toBeTruthy();
    expect(summary.howToThink).toBeTruthy();
    expect(summary.nextTimeTip).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/mistake/build-explanation-summary.test.ts`
Expected: FAIL because the builder file does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/ui/build-explanation-summary.ts
import type { ExplanationSummary } from './types';

export function buildFallbackExplanationSummary(input: {
  problemText: string;
  studentAnswer?: string;
}): ExplanationSummary {
  return {
    stuckPoint: '这题主要卡在数量关系或单位转换没有先找准。',
    whyStuck: '这类题不能直接算，要先确认题目里的已知量和目标量。',
    howToThink: '先圈出关键数量关系，再决定先换算还是先列式。',
    nextTimeTip: '下次遇到同类题，先把关键关系写出来再下笔。',
  };
}
```

```tsx
// components/mistake/homework-result-shell.tsx
// Render the fixed four-card layout plus CTA buttons:
// - 做 1 道同类题
// - 再讲简单一点
// - 有帮助 / 没帮助
```

```tsx
// app/classroom/[id]/page.tsx
// Wrap <Stage /> with HomeworkResultShell when the current session originated from a mistake flow.
// Read `generationParams.mistakeSessionId`, fetch the session payload, and render summary cards above or beside the existing Stage.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/mistake/build-explanation-summary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/mistake/build-explanation-summary.test.ts lib/mistake/ui/build-explanation-summary.ts components/mistake/homework-result-shell.tsx app/classroom/[id]/page.tsx
git commit -m "feat: add homework result shell to classroom"
```

### Task 5: Add One-Question Quiz And Quiz Result Pages

**Files:**
- Create: `d:\AItrade\AI-MATH-MISTAKE\app\quiz\[id]\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\app\quiz-result\[id]\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\quiz.ts`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\lib\quiz\persistence.ts`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\quiz-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { buildHomeworkQuiz } from '@/lib/mistake/ui/quiz';

describe('buildHomeworkQuiz', () => {
  it('returns exactly one quiz question for the homework-entry flow', () => {
    const quiz = buildHomeworkQuiz({
      problemText: '2 米减去 80 厘米还剩多少厘米？',
    });

    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]?.title).toBe('第 1 题');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/mistake/quiz-flow.test.ts`
Expected: FAIL because `buildHomeworkQuiz` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/ui/quiz.ts
export function buildHomeworkQuiz(input: { problemText: string }) {
  return {
    questions: [
      {
        id: 'q1',
        title: '第 1 题',
        hint: '这题和刚才很像，先自己想一想。',
        stem: `同类题：${input.problemText}`,
        type: 'input' as const,
      },
    ],
  };
}
```

```tsx
// app/quiz/[id]/page.tsx
// 1. Load the mistake session by id.
// 2. Build one question.
// 3. Persist the answer through `lib/quiz/persistence.ts`.
// 4. Navigate to `/quiz-result/[id]`.
```

```tsx
// app/quiz-result/[id]/page.tsx
// 1. Read the saved answer and determine pass/fail using a simple, explicit comparison path.
// 2. Render success/fail copy with navigation back to `/mistake` or `/classroom/[id]`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/mistake/quiz-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/mistake/quiz-flow.test.ts app/quiz/[id]/page.tsx app/quiz-result/[id]/page.tsx lib/mistake/ui/quiz.ts lib/quiz/persistence.ts
git commit -m "feat: add homework quiz flow"
```

### Task 6: Add Lightweight History And Parent Pages

**Files:**
- Create: `d:\AItrade\AI-MATH-MISTAKE\app\history\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\app\parent\[id]\page.tsx`
- Create: `d:\AItrade\AI-MATH-MISTAKE\lib\mistake\ui\history.ts`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { groupHomeworkHistory } from '@/lib/mistake/ui/history';

describe('groupHomeworkHistory', () => {
  it('splits sessions into pending and done groups', () => {
    const grouped = groupHomeworkHistory([
      { id: 'a', problemPreview: '题目 A', status: 'pending', updatedAt: 1, explanationId: 'e1' },
      { id: 'b', problemPreview: '题目 B', status: 'done', updatedAt: 2, explanationId: 'e2' },
    ]);

    expect(grouped.pending).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/mistake/history.test.ts`
Expected: FAIL because `history.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/mistake/ui/history.ts
import type { HomeworkHistoryStatus } from './types';

export type HomeworkHistoryItem = {
  id: string;
  problemPreview: string;
  status: HomeworkHistoryStatus;
  updatedAt: number;
  explanationId: string;
};

export function groupHomeworkHistory(items: HomeworkHistoryItem[]) {
  return {
    pending: items.filter((item) => item.status === 'pending'),
    done: items.filter((item) => item.status === 'done'),
  };
}
```

```tsx
// app/history/page.tsx
// Read mistake sessions, map them into HomeworkHistoryItem, render grouped lists and empty state.
```

```tsx
// app/parent/[id]/page.tsx
// Read `parentSummary` from the mistake session and render the 3-4 card summary layout.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/mistake/history.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/mistake/history.test.ts app/history/page.tsx app/parent/[id]/page.tsx lib/mistake/ui/history.ts
git commit -m "feat: add homework history and parent summary pages"
```

### Task 7: Verify i18n Keys, Types, And Homework Route Wiring

**Files:**
- Modify: `d:\AItrade\AI-MATH-MISTAKE\lib\i18n\locales\zh-CN.json`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\app\mistake\page.tsx`
- Modify: `d:\AItrade\AI-MATH-MISTAKE\app\classroom\[id]\page.tsx`
- Test: `d:\AItrade\AI-MATH-MISTAKE\tests\mistake\homework-content.test.ts`

- [ ] **Step 1: Write the failing verification command**

Run: `pnpm check:i18n-keys`
Expected: FAIL with missing `homework*` keys if any route references are incomplete.

- [ ] **Step 2: Add the remaining homework-entry keys**

```json
{
  "homeworkRecognize": {
    "title": "先确认一下题目",
    "desc": "我先识别出了这道题，你看对不对。",
    "confirm": "识别正确，继续",
    "retry": "识别有误，重新上传",
    "failTitle": "这次没有看清楚题目",
    "failDesc": "试试重新拍一张，尽量拍清楚一点，只保留一道题。"
  },
  "homeworkLoading": {
    "title": "正在看这道题……",
    "desc": "先帮你找出它在考什么，再用容易懂的方法讲清楚。"
  },
  "homeworkResult": {
    "title": "这题我来陪你一起弄明白",
    "desc": "这道题刚刚卡住了，先别急，我们一步一步来。",
    "block1Title": "你卡住的地方",
    "block2Title": "为什么会卡住",
    "block3Title": "这题该怎么想",
    "block4Title": "下次遇到时记住",
    "ctaPrimary": "我懂了，做 1 道同类题",
    "ctaSecondary": "还是有点不懂，再讲简单一点"
  }
}
```

- [ ] **Step 3: Run verification commands**

Run: `pnpm check:i18n-keys && pnpm test tests/mistake/homework-content.test.ts tests/mistake/recognize-session.test.ts tests/mistake/build-explanation-summary.test.ts tests/mistake/quiz-flow.test.ts tests/mistake/history.test.ts`
Expected: PASS

- [ ] **Step 4: Run type checking**

Run: `pnpm exec tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/locales/zh-CN.json app/mistake/page.tsx app/classroom/[id]/page.tsx tests/mistake
git commit -m "feat: wire homework entry routes and copy"
```

## Spec Coverage Check

- `/mistake` 首页化：Task 2
- `/mistake/recognize`：Task 2
- `/generation-preview` 中转文案：Task 7
- `/classroom` 结果页外壳与四卡片：Task 4
- `/quiz` 与 `/quiz-result`：Task 5
- `/history` 与 `/parent`：Task 6
- 结构化字段与过渡适配：Task 1 / Task 3 / Task 4 / Task 5 / Task 6
- i18n 独立命名空间：Task 1 / Task 7

## Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task names concrete files, tests, and commands.
- The only intentionally flexible portion is the fallback summary text, which is still defined explicitly.

## Type Consistency Check

- `ExplanationSummary` is defined once in `lib/mistake/ui/types.ts` and reused by session storage and classroom shell work.
- `HomeworkHistoryStatus` matches the planned `pending | done` grouping across the history helpers and pages.
- Quiz flow stays on a single-question contract throughout the plan.

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-homework-entry-frontend.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
