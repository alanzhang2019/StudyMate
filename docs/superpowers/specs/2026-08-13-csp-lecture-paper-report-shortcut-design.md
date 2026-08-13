# csp-lecture 卡片「查看上次成绩」快捷入口 — 设计

## 目标

在 `/csp-lecture` 真题卷卡片的折叠面板内，新增一个「查看上次成绩」入口，免去
「展开章节 → 选第一节 → 等 QuizView rehydrate」三步。点击后弹出 modal 显示
该卷最近一次的总分和分类得分。

不重构 QuizView，不新建 server endpoint，纯前端 + 复用 `paper-trend` 接口。

## 范围

**在范围内**
- 真题卷卡片（`bucket === 'paper'`）的折叠面板
- 弹窗显示「总分 + 三个分类得分 + 提交时间」
- 已交卷 → 「查看上次成绩」按钮；未提交过任何小节 → 「开始挑战」按钮

**不在范围内（明确 YAGNI）**
- 弹窗内展示逐题对错（要看单题对错还是进课堂）
- 在折叠面板**外**显示入口
- 课件（primer）卡片
- 离线 / PWA / 推送通知
- 把现有 FinalScorePage 抽出来复用

## 架构

```
PaperLectureCard (server)
  └─ ExpandChapterList (client) ── 新增 isPaper / paperId / title props
       ├─ useEffect(open && isPaper) → GET /api/csp-quiz/paper-trend
       │   └─ module-level 缓存 (5min TTL) 避免 24 张卡片并发拉 24 次
       ├─ 现有章节列表
       └─ PaperReportRow (client, 新建)  ← 渲染在章节列表**顶部**
            ├─ 有 paperData  → 紫蓝渐变 "查看上次成绩" 按钮
            │                  → 打开 PaperReportModal
            └─ 无 paperData  → 蓝色实心 "开始挑战" 按钮 → /classroom/<id>

PaperReportModal (client, 新建)
  └─ PaperLectureCard 右上角关闭 / ESC / 背景点击关闭
  └─ 内容: 总分 + 单项选择 / 阅读程序 / 完善程序 + 提交时间
```

## 文件改动

### 新增
- `frontend/app/csp-lecture/PaperReportRow.tsx` (~50 行)
  - 客户端组件
  - Props: `{ classroomId: string; paper: PaperTrendItem | null; onOpen: () => void }`
  - 状态：本地 only
- `frontend/components/csp-lecture/paper-report-modal.tsx` (~120 行)
  - 客户端组件
  - Props: `{ open: boolean; onClose: () => void; paper: PaperTrendItem | null; title: string }`
  - 复用 paper-trend 的 labels 做分类标题

### 修改
- `frontend/app/csp-lecture/page.tsx`
  - 在 `ExpandChapterList` 上传 `isPaper={bucketOf(item.id) === 'paper'}`、
    `paperId={item.id}`、`paperTitle={item.title}`
  - `bucketOf` 已经在文件里（约 171-172 行），复用
- `frontend/app/csp-lecture/ExpandChapterList.tsx`
  - 新增 props 类型：`isPaper?: boolean; paperId?: string; paperTitle?: string`
  - `useEffect(() => { if (open && isPaper) loadPaperTrend() }, [open, isPaper])`
  - 模块级缓存 `let _paperTrendCache: { ts: number; data: any } | null = null`
    + TTL 5min
  - 把 `paperDataFor(paperId)` 透传给 `PaperReportRow`

### 不改
- `frontend/app/api/csp-quiz/paper-trend/route.ts`（直接消费现有响应）
- `frontend/components/scene-renderers/quiz-view.tsx`（不动）
- `frontend/lib/quiz/persistence.ts`（不动）

## 数据契约

直接消费 `/api/csp-quiz/paper-trend` 已有的 `papers[]` 单条：

```ts
type PaperTrendItem = {
  classroomId: string;
  title: string;
  year: number;
  group: 'J' | 'S';
  choice:  { earned: number; max: number };
  read:    { earned: number; max: number };
  perfect: { earned: number; max: number };
  total:   { earned: number; max: number; score: number };
  submittedAt: string;  // ISO
  sceneCount: number;
  mode: 'standard' | 'legacy';
};
```

**判定"未交卷"**：上面这条数据**不在 `papers[]` 里**。因为
`paper-trend/route.ts:224-227` 只对 `cspQuizSubmission.findAllByUser` 有
行（任意小节提交过）的用户返回 papers。一次性提交任意小节就算"做过"。

**判定"做过但 modal 没数据"**：不存在该场景——只要 paper 在列表里，
`total.earned` 一定 ≥ 0。

## UI 规范

### PaperReportRow（在章节列表**第一行**）

```
┌─────────────────────────────────────────────┐
│ 📊  上次成绩：85 / 100 (85%)   [查看详情]   │  ← 有数据时
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🚀  尚未挑战这套卷  [开始挑战]              │  ← 无数据时
└─────────────────────────────────────────────┘
```

- 行高 ≥ 章节列表项高度，保持视觉齐平
- 浅紫/浅蓝渐变底色，与下方章节 `<ol>` 区分
- 左边 4px 强调色左边框，提示"这是特殊行"
- 整行可点（不是只有按钮可点），提升点击区
- "未提交"状态下整行直接是 `<a href="/classroom/<id>">`

### PaperReportModal

```
┌──────────────────────────────────────────────┐
│  2016年普及组 CSP-J 初赛真题卷            ✕  │
│──────────────────────────────────────────────│
│                                              │
│              85                              │
│             ────                              │
│           / 100                              │
│            85%                               │
│        3 节 · 1 周前                          │
│                                              │
│  ────────────────────────────────────────    │
│  单项选择题    25 / 30     ████████████░░░  │
│  阅读程序题    30 / 35     █████████████░░  │
│  完善程序题    30 / 35     █████████████░░  │
│                                              │
│──────────────────────────────────────────────│
│                    [重新答题]  [查看详情]    │
└──────────────────────────────────────────────┘
```

- 模态框 max-width 480px
- 进度条颜色与 csp-lecture 页面整体调性一致（indigo 主色）
- 底部按钮：
  - "重新答题" → `clearFinalizedPaper()` + `/classroom/<id>`
    (调用 quiz-view 现有的 clear 函数路径，**新代码里只调用
    `localStorage.removeItem('paperFinal:' + id)` 然后跳转**)
  - "查看详情" → 跳 `/classroom/<id>?scene=1` 走 QuizView rehydrate
- 提交时间用 `Intl.RelativeTimeFormat('zh-CN')` 显示（"1 周前"）
- ESC / 背景点击关闭
- 焦点 trap + 关闭时把焦点还给原触发按钮（无障碍）

## 错误 / 边界

| 场景 | 行为 |
|------|------|
| 用户未登录，paper-trend 返回 401 | 折叠面板不渲染 PaperReportRow（隐藏整行） |
| 拉 paper-trend 失败 | 按钮显示为"开始挑战"（降级到最强引导），不阻塞 |
| `papers[]` 找不到该 classroomId | 显示"开始挑战"按钮 |
| 用户在 modal 打开时跨标签页被登出 | modal 内部 paper 数据保持原样，关闭按钮仍可用 |
| 多次快速展开 / 收起 | module-level 缓存 + useEffect deps 用 `[open, isPaper]`，避免抖动 |
| 24 张真题卡同时展开（理论极端） | module-level 缓存确保只 fetch 一次 |

## 不需要做的事（防过度）

- ❌ 不做卡片右上角徽章（用户已选"放折叠面板"）
- ❌ 不做单独的 `/paper-report/[id]` 路由（modal 够用）
- ❌ 不重构 FinalScorePage 抽出来
- ❌ 不写新的 server endpoint
- ❌ 不动 QuizView / persistence.ts
- ❌ 不做单元测试（项目目前没有 e2e/test runner 配置；手动验证即可）

## 验证步骤（手动）

1. 部署后访问 `/csp-lecture`
2. 找到 **2024 普及组**（已有完成提交）
   - 展开章节 → 看到"查看上次成绩"行，紫蓝渐变
   - 点击 → modal 弹出，总分正确，分类正确
   - ESC 关闭 ✓
3. 找到 **2016 普及组**（只做了部分小节）
   - 展开 → 看到"查看上次成绩"，分数低于满分
   - modal 展示提交时间
4. 找到 **2025 普及组**（从未做过）
   - 展开 → 看到"开始挑战"按钮
   - 点击 → 跳 `/classroom/cm_imp_cspj2025j_v1`
5. 刷新页面 / 重新展开同一卡片 → module-level 缓存命中，不再 fetch
6. 在控制台看 network → 24 张卡片只应触发 1 次 `/paper-trend` 请求
