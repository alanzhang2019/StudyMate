# csp-lecture 卡片「查看上次成绩」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/csp-lecture` 真题卷卡片的折叠面板顶部新增「查看上次成绩」入口，点击弹出 modal 显示该卷最近一次总分和分类得分。

**Architecture:** 复用现有 `GET /api/csp-quiz/paper-trend` 接口获取分数数据；折叠面板展开时拉一次（带 5min module-level 缓存）；modal 直接消费缓存数据，零服务端改动、零 QuizView 改动。

**Tech Stack:** Next.js 14 (App Router) + React + TypeScript + Tailwind + lucide-react。验证用 `npx tsc --noEmit`（项目无 Jest/Vitest 单元测试，类型检查是唯一自动化校验手段）。

---

## File Map

**新增：**
- `frontend/lib/types/paper-trend.ts` —— 共享 `PaperTrendItem` 类型
- `frontend/components/csp-lecture/paper-report-modal.tsx` —— 报告 modal
- `frontend/app/csp-lecture/PaperReportRow.tsx` —— 折叠面板内单行

**修改：**
- `frontend/app/csp-lecture/ExpandChapterList.tsx` —— 加 `isPaper` prop + paper-trend 拉取 + 集成两新组件
- `frontend/app/csp-lecture/page.tsx` —— 在 `<ExpandChapterList>` 调用处传 `isPaper`

**不修改：**
- QuizView / persistence.ts / paper-trend 接口

---

## Task 1: 共享 `PaperTrendItem` 类型

**Files:**
- Create: `frontend/lib/types/paper-trend.ts`

- [ ] **Step 1: 写入类型定义**

```ts
// frontend/lib/types/paper-trend.ts
//
// 与 GET /api/csp-quiz/paper-trend 响应里 papers[] 的单条结构对应。
// 这里独立定义而不是 import route.ts 的 type，是因为前端组件不应该
// 反向依赖 server 路由文件。
export type PaperTrendItem = {
  classroomId: string;
  title: string;
  year: number;
  group: 'J' | 'S';
  choice: { earned: number; max: number };
  read: { earned: number; max: number };
  perfect: { earned: number; max: number };
  total: { earned: number; max: number; score: number };
  submittedAt: string;
  sceneCount: number;
  mode: 'standard' | 'legacy';
};
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: PASS, no errors.

- [ ] **Step 3: 提交**

```bash
git add frontend/lib/types/paper-trend.ts
git commit -m "feat(csp-lecture): add shared PaperTrendItem type"
```

---

## Task 2: `PaperReportModal` 组件

**Files:**
- Create: `frontend/components/csp-lecture/paper-report-modal.tsx`

- [ ] **Step 1: 写入组件**

```tsx
// frontend/components/csp-lecture/paper-report-modal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import type { PaperTrendItem } from '@/lib/types/paper-trend';

const CATEGORY_LABEL: Record<'choice' | 'read' | 'perfect', string> = {
  choice: '单项选择题',
  read: '阅读程序题',
  perfect: '完善程序题',
};

// "N 天前" 风格的中文相对时间。Intl.RelativeTimeFormat 输出的
// "1周前" 排版不友好（缺空格），自己格式化。
function relativeTimeZh(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '刚刚';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} 周前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 个月前`;
  return `${Math.floor(day / 365)} 年前`;
}

export function PaperReportModal({
  open,
  onClose,
  paper,
}: {
  open: boolean;
  onClose: () => void;
  paper: PaperTrendItem | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // ESC 关闭 + 打开时聚焦关闭按钮
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !paper) return null;

  const pct =
    paper.total.max > 0
      ? Math.round((paper.total.earned / paper.total.max) * 100)
      : 0;

  const handleRetry = () => {
    // 清除 QuizView 用来 rehydrate finalized 结果的 localStorage key
    localStorage.removeItem(`paperFinal:${paper.classroomId}`);
    window.location.href = `/classroom/${paper.classroomId}`;
  };

  const handleViewDetails = () => {
    window.location.href = `/classroom/${paper.classroomId}?scene=1`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paper-report-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <h2
            id="paper-report-title"
            className="text-base font-semibold text-slate-800 pr-4"
          >
            {paper.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 -m-1"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 text-center">
          <div className="text-5xl font-bold text-indigo-600 leading-none">
            {paper.total.earned}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            / {paper.total.max} 分
          </div>
          <div className="text-2xl font-semibold text-slate-700 mt-1">
            {pct}%
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {paper.sceneCount} 节 · {relativeTimeZh(paper.submittedAt)}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {(['choice', 'read', 'perfect'] as const).map((cat) => {
            const v = paper[cat];
            const ratio = v.max > 0 ? v.earned / v.max : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {v.earned} / {v.max}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新答题
          </button>
          <button
            type="button"
            onClick={handleViewDetails}
            className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 rounded-lg px-3 py-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: PASS, no errors.

- [ ] **Step 3: 提交**

```bash
git add frontend/components/csp-lecture/paper-report-modal.tsx
git commit -m "feat(csp-lecture): add PaperReportModal component"
```

---

## Task 3: `PaperReportRow` 组件

**Files:**
- Create: `frontend/app/csp-lecture/PaperReportRow.tsx`

- [ ] **Step 1: 写入组件**

```tsx
// frontend/app/csp-lecture/PaperReportRow.tsx
'use client';

import { BarChart3, Rocket } from 'lucide-react';
import type { PaperTrendItem } from '@/lib/types/paper-trend';

/**
 * 折叠面板内"上次成绩 / 开始挑战"特殊行。
 *
 *  - paper === null：未提交过任意小节 → 整行是个 <a>，跳课堂首页
 *  - paper !== null：已交卷 → 整行是 <button>，调 onOpenModal 弹 modal
 *
 * 视觉上与下方 <ol> 章节项齐平，但用 amber 渐变 + 4px 强调左边框
 * 突出"非普通章节"语义。
 */
export function PaperReportRow({
  classroomId,
  paper,
  onOpenModal,
}: {
  classroomId: string;
  paper: PaperTrendItem | null;
  onOpenModal: () => void;
}) {
  if (!paper) {
    return (
      <a
        href={`/classroom/${classroomId}`}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5
                   bg-gradient-to-r from-indigo-50 to-blue-50
                   border-l-4 border-indigo-400
                   hover:from-indigo-100 hover:to-blue-100
                   transition-colors"
      >
        <Rocket className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="text-sm font-medium text-indigo-700 flex-1">
          尚未挑战这套卷
        </span>
        <span className="text-xs font-semibold text-white bg-indigo-500 rounded px-2 py-0.5">
          开始挑战
        </span>
      </a>
    );
  }

  const pct =
    paper.total.max > 0
      ? Math.round((paper.total.earned / paper.total.max) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="w-full text-left flex items-center gap-2.5 rounded-md px-2 py-1.5
                 bg-gradient-to-r from-amber-50 to-yellow-50
                 border-l-4 border-amber-400
                 hover:from-amber-100 hover:to-yellow-100
                 transition-colors
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" />
      <span className="text-sm font-medium text-amber-800 flex-1">
        上次成绩：{paper.total.earned} / {paper.total.max}（{pct}%）
      </span>
      <span className="text-xs font-semibold text-amber-900 bg-amber-200 rounded px-2 py-0.5">
        查看详情
      </span>
    </button>
  );
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: PASS, no errors.

- [ ] **Step 3: 提交**

```bash
git add frontend/app/csp-lecture/PaperReportRow.tsx
git commit -m "feat(csp-lecture): add PaperReportRow component"
```

---

## Task 4: 改造 `ExpandChapterList`

**Files:**
- Modify: `frontend/app/csp-lecture/ExpandChapterList.tsx`

- [ ] **Step 1: 顶部 import 调整**

替换顶部 import 段：

OLD:
```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ListChecks, MousePointerClick, Folder } from 'lucide-react';
import type { SceneType } from '@/lib/types/stage';
```

NEW:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ListChecks, MousePointerClick, Folder } from 'lucide-react';
import type { SceneType } from '@/lib/types/stage';
import { PaperReportRow } from './PaperReportRow';
import { PaperReportModal } from '@/components/csp-lecture/paper-report-modal';
import type { PaperTrendItem } from '@/lib/types/paper-trend';
```

- [ ] **Step 2: 在 `TYPE_META` 之后插入 module-level 缓存 + fetch 函数**

紧跟 `TYPE_META` 常量定义之后、组件定义之前，插入以下内容：

```tsx
// module-level cache for paper-trend (5min TTL).
// 24 张真题卡都可能展开，缓存避免 24 次重复 fetch。
type PaperTrendCache = { ts: number; data: PaperTrendItem[] };
let _paperTrendCache: PaperTrendCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadPaperTrend(): Promise<PaperTrendItem[] | null> {
  const now = Date.now();
  if (_paperTrendCache && now - _paperTrendCache.ts < CACHE_TTL_MS) {
    return _paperTrendCache.data;
  }
  try {
    const res = await fetch('/api/csp-quiz/paper-trend');
    if (!res.ok) return null;
    const json = await res.json();
    const papers: PaperTrendItem[] = Array.isArray(json?.papers)
      ? json.papers
      : [];
    _paperTrendCache = { ts: now, data: papers };
    return papers;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: 改 component signature + 加 state/useEffect**

OLD:
```tsx
export function ExpandChapterList({
  lectureId,
  chapters,
}: {
  lectureId: string;
  chapters: Chapter[];
}) {
  const [open, setOpen] = useState(false);

  if (chapters.length === 0) {
```

NEW:
```tsx
export function ExpandChapterList({
  lectureId,
  chapters,
  isPaper,
}: {
  lectureId: string;
  chapters: Chapter[];
  isPaper?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [paperList, setPaperList] = useState<PaperTrendItem[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 真题卡片：展开时拉 paper-trend（命中模块缓存，1 次/5min）
  useEffect(() => {
    if (!open || !isPaper) return;
    let cancelled = false;
    loadPaperTrend().then((data) => {
      if (!cancelled) setPaperList(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, isPaper]);

  const myPaper = paperList?.find((p) => p.classroomId === lectureId) ?? null;

  if (chapters.length === 0) {
```

- [ ] **Step 4: 在 `<ol>` 顶部插入 PaperReportRow**

OLD:
```tsx
      {open && (
        <ol className="mt-3 space-y-1.5 border-l-2 border-indigo-100 pl-3">
          {chapters.map((c) => {
```

NEW:
```tsx
      {open && (
        <ol className="mt-3 space-y-1.5 border-l-2 border-indigo-100 pl-3">
          {isPaper && paperList !== null && (
            <li key="__paper_report__">
              <PaperReportRow
                classroomId={lectureId}
                paper={myPaper}
                onOpenModal={() => setModalOpen(true)}
              />
            </li>
          )}
          {chapters.map((c) => {
```

- [ ] **Step 5: 在 `</div>` 收尾前挂 modal**

OLD:
```tsx
          })}
        </ol>
      )}
    </div>
  );
}
```

NEW:
```tsx
          })}
        </ol>
      )}

      {isPaper && (
        <PaperReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          paper={myPaper}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: PASS, no errors.

- [ ] **Step 7: 提交**

```bash
git add frontend/app/csp-lecture/ExpandChapterList.tsx
git commit -m "feat(csp-lecture): integrate paper-trend fetch + PaperReportRow into ExpandChapterList"
```

---

## Task 5: 在 `csp-lecture/page.tsx` 传 `isPaper`

**Files:**
- Modify: `frontend/app/csp-lecture/page.tsx`

- [ ] **Step 1: 定位 `ExpandChapterList` 调用处**

在文件里搜 `ExpandChapterList`，找到 `item.chapters` 那行调用。

当前代码大致是（你看到的可能是 spread 写法或普通写法）：
```tsx
<ExpandChapterList lectureId={item.id} chapters={item.chapters} />
```

替换为：
```tsx
<ExpandChapterList
  lectureId={item.id}
  chapters={item.chapters}
  isPaper={bucketOf(item.id) === 'paper'}
/>
```

注意：
- `bucketOf` 在当前文件 ~171-172 行已定义（类型 `(id: string) => 'primer' | 'paper'`），不要重新声明
- 课件（primer）卡片 `bucketOf` 返回 `'primer'`，`isPaper` 走 `false`，PaperReportRow 不渲染 —— 行为正确

- [ ] **Step 2: 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: PASS, no errors.

- [ ] **Step 3: 提交**

```bash
git add frontend/app/csp-lecture/page.tsx
git commit -m "feat(csp-lecture): pass isPaper prop to ExpandChapterList"
```

---

## Task 6: 部署 + 手动验证

- [ ] **Step 1: 部署到生产**

```bash
cd /home/ubuntu/studymate && git pull origin master && docker compose up -d --build frontend
```

Expected: 容器构建成功，无错误日志。

- [ ] **Step 2: 浏览器验证 — 已交卷卷子**

1. 打开 `https://aijiangti.cn/csp-lecture`
2. 找到 **2024 普及组**（你已交卷过的那套）
3. 点 **「查看章节 (N)」** 展开
4. 第一行应该是 amber 渐变底色："上次成绩：XX / 100（XX%）" + "查看详情" 徽章
5. 点这一行 → modal 弹出，显示总分 + 三个分类得分 + "N 天前"
6. 按 ESC → modal 关闭，焦点回到"查看详情"按钮
7. 点 modal 外的灰色区域 → modal 关闭
8. 重新展开 → 模块缓存命中，DevTools Network 不应再次出现 `/api/csp-quiz/paper-trend`

- [ ] **Step 3: 浏览器验证 — 未交卷卷子**

1. 找到 **2025 普及组**（从未做过）
2. 展开章节
3. 第一行应该是 indigo 渐变："尚未挑战这套卷" + "开始挑战" 徽章
4. 点这一行 → 直接跳到 `/classroom/cm_imp_cspj2025j_v1`

- [ ] **Step 4: 浏览器验证 — 只做了部分小节的卷子**

1. 找到 **2016 普及组**（你之前只做了部分小节）
2. 展开章节
3. 第一行应该是 amber "上次成绩：XX / 100"（因为 paper-trend 不要求交卷完成，只看 cspQuizSubmission 表里有无行）
4. 点 modal 里的 **「重新答题」** → localStorage 清掉 + 跳到课堂首页
5. 课堂首页应该从 `not_started` 阶段开始（不会 rehydrate 出 finalized）

- [ ] **Step 5: 课件卡片回归**

1. 找到任意课件卡片（不是真题，比如 "1、计算机基础"）
2. 展开章节
3. 确认**没有** amber/indigo 特殊行 —— 只显示原本的章节列表
4. 课件不受影响

- [ ] **Step 6: 缓存共享验证**

1. 打开 DevTools Network 面板
2. 连续展开 3 张不同的真题卡片
3. 应该只看到 **1 次** `/api/csp-quiz/paper-trend` 请求（不是 3 次）

---

## Self-Review Checklist

- [x] **Spec 覆盖**：每个 spec 章节（架构、文件改动、数据契约、UI、错误处理、不做的事、验证）都有对应 task
- [x] **无 placeholder**：所有 step 包含完整代码 / 完整命令
- [x] **类型一致**：`PaperTrendItem` 在 Task 1 定义一次，Task 2/3/4/5 复用
- [x] **YAGNI**：没新建 server endpoint，没重构 QuizView，没加路由
- [x] **DRY**：module-level 缓存只写一次；modal 进度条渲染用 `(['choice','read','perfect'] as const).map`
- [x] **频繁提交**：每个 task 独立 commit
