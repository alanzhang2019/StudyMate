# CSP 真题卷交卷 + 总分 + 重置功能设计文档

- 日期：2026-07-26
- 状态：已批准（用户同意方案：**混合模式交卷 + 允许重置重做**）
- 范围：仅 `cm_imp_cspj2024j_v1.json`（2024 CSP-J 真题卷）这一门课件，架构上要保留对其它 CSP 真题卷的扩展性

## 1. 背景与目标

学生做完 2024 CSP-J 真题卷 6 个 scene（共 42 题、100 分）后，需要像真考试一样：

1. 看到右上角的"交卷"按钮（**常驻**，任何时候可点）
2. 点击后弹窗确认（未答完时警示"未答按 0 分计算"）
3. 一次性提交所有 6 个 scene → 跳转到总分页
4. 总分页看到总分 + 等级 + 每 scene 的得分小卡片
5. 允许**重新答题**（重置已提交答案 → 重新走 answering 阶段）

现状：QuizView 在答完最后一题自动进入 reviewing（`gradeChoiceQuestions` 跑完 → 直接展示结果）。没有"交卷"按钮，没有跨 scene 总分，没有重置。

## 2. 非目标（YAGNI）

- 不重做"答题 + 批改"逻辑本身（已存在，稳定）
- 不做排行榜联动（本次交卷分数**只**展示在总分页；是否进排行榜后续 spec 再议）
- 不做时间限制（真考试 2 小时，但 MVP 不引入计时器，避免学生被卡住焦虑）
- 不做错题本自动归集（"查看错题"按钮暂时链接到 `/csp-lecture` 课件列表首页；错题本后续 spec）
- 不改 csp-quiz/submit 接口签名（仍按 per-scene 提交）
- 不动 `evaluateCompletion`（50% 阈值仍生效，混合交卷后 latched 写入不影响）

## 3. 架构

### 3.1 状态机（QuizView 内部）

```
            ┌─ onStart ─────────────► answering
            │                              │
 not_started                               │
            │                              ├─ answerLastQ ──► [auto: reviewing 单 scene]  (旧路径)
            │                              │
            │                              ├─ onFinalizeClick ─► [modal: 确认交卷]
            │                              │                      │
            │                              │                      └─ confirm ──► submitting
            │                              │                                       │
            │                              │                                       ├─ all ok ──► finalized
            │                              │                                       │
            │                              │                                       └─ any fail ──► answering
            │                              │
            │                              └─ onResetClick (from finalized) ─► answering
            │
            └─ onMount (auto) ──► answering
```

新加 2 个阶段：
- `submitting`（中间态）：批量提交 6 个 scene 中，禁用所有 UI
- `finalized`（终态）：总分页

旧路径 `answering → reviewing` 保留（其它课件的"单 scene 自闭环"行为不变）；`finalized` 是 CSP 真题卷特有的终点。

### 3.2 数据流

**交卷（finalize）流程**：
```
QuizView (submitting)
  → Promise.all(
      for each scene:
        cspQuizApi.submit({ sceneId, answers, classroomId, draft: false })
    )
  → results: SceneResult[6]
  → setState({ phase: 'finalized', sceneResults: results })
```

**重置流程**：
```
QuizView (finalized, user clicks "重新答题")
  → for each scene:
      cspQuizApi.reset({ sceneId })    // 新增端点
  → setState({ phase: 'answering', sceneResults: [] })
```

### 3.3 组件拆分

| 组件 | 位置 | 职责 |
|------|------|------|
| `QuizView` | 已有 | 顶层状态机；新增 `phase: 'submitting' \| 'finalized'` |
| `SubmitPaperButton` | **新** | 顶部常驻"交卷"按钮 + 弹窗 |
| `FinalScorePage` | **新** | 总分页（仅在 `finalized` 阶段渲染） |
| `ConfirmSubmitModal` | 内联在 SubmitPaperButton | 弹窗主体；动态文案（"已答 N/M" + "未答按 0 分"提示） |
| `SceneScoreCard` | 内联在 FinalScorePage | 每个 scene 1 张小卡片（标题 + 得分 + ✓/✗） |
| 现有 `QuizCover` / `QuestionCard` 等 | 不动 | |

### 3.4 后端

- **复用** `frontend/app/api/csp-quiz/submit/route.ts`（per-scene submit 已有）
- **新增** `frontend/app/api/csp-quiz/reset/route.ts`：
  - POST `{ sceneId, userId }`
  - 删 `csp_quiz_submissions` 中该 scene 的记录（per-user per-scene latched）
  - 删 `csp_progress.completedAt` 若该 classroom 现在不再满足 50% 阈值
  - 返回 `{ ok: true }`

### 3.5 数据库

不引入新表。`csp_quiz_submissions` 表已经按 `(userId, sceneId)` 唯一，reset 就是删行。

## 4. 关键交互细节

### 4.1 顶部"交卷"按钮可见性

| 阶段 | 显示 |
|------|------|
| not_started | 不显示（cover 阶段，逻辑上未开始） |
| answering | **常驻**"交卷"按钮（紫色实心） |
| submitting | 按钮变 loading 旋转器 + "提交中..."文案，禁用 |
| reviewing | 不显示（单 scene 自动 reviewing） |
| finalized | 不显示；改为 "✅ 已交卷" 灰色标签（只读） |

### 4.2 弹窗文案

- 已答完："本次共 X 道题，答对 Y 道，提交后**不可修改**。"
- 未答完："还有 N 道题未答，**未答的题按 0 分计算**。确认交卷？"
- 按钮：主"确认交卷"，次"再检查一下"

### 4.3 总分页布局

```
┌─────────────────────────────────────────┐
│              📊  总分                    │
│              68 / 100                   │
│           [中级] 徽章                    │
│  ─────────────────────────────────      │
│  一、单项选择题       26 / 30    ✓     │
│  二、阅读程序(1)     10.5 / 10.5 ✓     │
│  三、阅读程序(2)     13.5 / 16.5 ✗     │
│  四、阅读程序(3)      9  / 13.5 ✗     │
│  五、完善程序(1)     12  / 15    ✗     │
│  六、完善程序(2)      0  / 15    ✗     │
│                                         │
│  [重新答题]  [返回课件列表]  [查看错题]  │
└─────────────────────────────────────────┘
```

- 总分 = 6 scene 正确分之和（不重不漏，= 试卷满分 100）
- 等级徽章来源：硬编码映射表（`lib/server/csp-placement.ts`）：
  - 0-30 = beginner（入门）
  - 31-70 = intermediate（中级）
  - 71-100 = advanced（高级）
- [重新答题] 调 `csp-quiz/reset` 后回到 answering
- [返回课件列表] 跳 `/csp-lecture`
- [查看错题] 暂时跳 `/csp-lecture`（错题本后续 spec）

### 4.4 错误处理

- 批量提交任一 scene 失败 → 弹 `alert('提交失败：${sceneId}')` + 仍停 answering 阶段
- 用户可继续点交卷重试
- 不做自动重试（避免 LLM 调用消耗 + 学生操作不确定性）

## 5. 数据模型

```ts
// 扩展 QuizView
type Phase = 'not_started' | 'answering' | 'submitting' | 'grading' | 'reviewing' | 'finalized';

// 新增 scene 结果聚合
type SceneResult = {
  sceneId: string;
  title: string;
  order: number;
  totalQuestions: number;
  correctCount: number;
  points: number;       // 满分（=题分之和）
  earnedPoints: number; // 实得
};

// 新增
type FinalizedState = {
  phase: 'finalized';
  sceneResults: SceneResult[];
  totalEarned: number;
  totalPossible: number;
  level: 'beginner' | 'intermediate' | 'advanced';
};
```

## 6. 实施计划（待 writing-plans skill 输出）

1. 后端：`/api/csp-quiz/reset/route.ts` 新增（参考 `/submit` 的鉴权 + DB 操作）
2. 前端 `lib/api/csp-quiz.ts` 加 `reset()` 客户端
3. 前端 `QuizView`：
   - 状态机加 `submitting` + `finalized`
   - 顶部加 `SubmitPaperButton`
   - 答完所有题不自动 reviewing（CSP 真题卷专用：`isFullPaper` 标记触发）
4. 新增 `FinalScorePage` 组件
5. 总分 → 等级映射：抽到 `lib/server/csp-placement.ts`（**为后续摸底功能铺路**）
6. 部署 + 验证（fix-deploy.sh）

## 7. 测试

- 单测：`maskName` 已有覆盖；`evaluateCompletion` 不动
- 端到端（手动）：登录学生 → 进 CSP 真题卷 → 答 3 题 → 交卷 → 看总分页 → 点"重新答题" → 重新答完 → 再交卷

## 8. 风险与备选

- **风险 1**：批量提交任一 scene 失败时，整批会卡住。备选：失败 scene 用 try/catch 单独跳过，弹窗告知哪些 scene 失败。
- **风险 2**：`csp_progress.completedAt` 写入是 latched（之前定下的），reset 不会回退它。备选：reset 端点里**主动删除 completedAt**（本次采用），保持"reset 真的回退到未完成"语义一致。
- **风险 3**：phase 不持久化。学生在 answering 阶段答到一半关页面，下次进入仍是 answering（题目答案通过 `csp-quiz/submit` 持久化为 draft，所以已答题的选项会保留）。MVP 可接受；如需"恢复到 submitting"需要 `csp_progress.state` 字段，下次再做。

## 9. 推迟到下个 spec 的事项

- 摸底功能（已经在 brainstorm 阶段，方向已定：AI 推荐 A 方案 + 5 题基础 + 4 个比赛区块）
- 错题本归集
- 排行榜是否纳入真题卷分数
- 计时器
