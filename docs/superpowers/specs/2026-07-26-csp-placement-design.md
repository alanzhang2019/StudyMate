# CSP 初赛水平摸底 + AI 推荐  设计文档

- 日期：2026-07-26
- 状态：✅ 自审通过，待用户 review
- 关联 spec：[2026-07-26-csp-final-paper-submit-design.md](./2026-07-26-csp-final-paper-submit-design.md)（已实施；今天 push）
- 关联 plan：[2026-07-26-csp-final-paper-submit.md](../plans/2026-07-26-csp-final-paper-submit.md)

## 1. 背景与目标

### 背景
CSP 课件系统已上线 12 个 csp-lecture 课件（含 2024 CSP-J 真题卷），学生进入 `/csp-lecture` 后看到完整课件列表但**没有任何引导**：
- 不知道该从哪个课件开始
- 不知道自己的水平适不适合当前课件
- 教师无法基于"实测"或"自报"画像给学生推荐

### 目标
给学生一条**"2 分钟摸底 → AI 推荐 → 直接进入合适课件"** 的引导路径，**不强制**（尊重学习自主权），但**易发现**（banner 在列表顶部）。

**核心成果指标**：
- 摸底完成率 ≥ 30%（B 方案基线；强制方案对照 80-95%）
- AI 推荐课件点击率 ≥ 50%（被推荐 → 实际进入）
- 摸底后 7 日内再学率 ≥ 60%

**不在本 spec 范围**：
- 教师管理端的"重新摸底"功能（v2）
- 错题本联动（v2 错题本 spec）
- CSP 真题卷 6 scene 一次性交卷（v2，已在 final-paper-submit 推迟清单记录）
- 摸底问卷的多语言 i18n（先用中文）

## 2. 架构

### 2.1 用户旅程

```
学生进入 /csp-lecture
  └─ PlacementBanner 拉 GET /api/csp-quiz/placement
       ├─ 无记录 → banner 状态 A："想了解你的 CSP 初赛水平？[2 分钟摸底]"
       └─ 有记录 → banner 状态 B："已摸底 (2025-12-08) · 等级 [中级] · [查看推荐] [重新摸底]"

点 [2 分钟摸底] / [重新摸底]
  └─ PlacementModal 打开（**单页长表单**，不分步）
       ├─ 顶部固定：标题 + 关闭按钮
       ├─ 主体可滚动：基础画像 5 题 + 比赛成绩 4 区块，全部在同一页
       │   ├─ 区块 1: 基础画像（5 题，单选下拉，必填）
       │   ├─ 区块 2: 比赛成绩（4 个独立子区块：省份 / CSP-J1 / CSP-S1 / CSP-J2 / CSP-S2 / GESP / 其它）
       │   │   每子区块统一模板：
       │   │   ├─ 行 1: 状态选择（"我没参加过" / "2025" / "2024" / ...）
       │   │   └─ 行 2: 根据选择展开对应字段
       │   └─ 区块 3: 提交按钮（固定底部或滚动到底）
       └─ 提交 → POST /api/csp-quiz/placement

点 [查看推荐] (banner 状态 B)
  └─ RecommendationCard modal
       ├─ 头部：等级徽章（beginner / intermediate / advanced）
       ├─ 中部：AI 文字点评（fallback 时显示占位）
       └─ 底部：3 个推荐课件卡片（点击 → 进对应课件 + 自动关闭 modal）

点 [重新摸底] (banner 状态 B)
  └─ 二次确认 modal："重新摸底会覆盖你当前的推荐，是否继续？"
       └─ 确认 → 打开 PlacementModal
```

### 2.2 组件边界

**后端**（`lib/server/`）：
- `csp-placement.ts`（已存在，今天 commit `dbe2468`）— 加 `scoreToLevelJ1` + `combinedLevel` + `fallbackRecommend`
- `csp-placement-llm.ts`（新）— 拼 LLM prompt + 调 `getCurrentModelConfig()` + 解析响应 + 15s 超时

**API**（`app/api/csp-quiz/placement/`）：
- `GET/route.ts`（新）— 返回当前用户的 `csp_placement` 行
- `POST/route.ts`（新）— UPSERT + 同步等 LLM（5s 软超时） + 返回

**前端组件**（`components/csp-lecture/`，新目录）：
- `PlacementBanner.tsx` — /csp-lecture 顶部 banner（3 种状态：未摸底/已摸底/重新摸底）
- `PlacementModal.tsx` — 问卷 modal（**单页长表单**，不分步）
- `RecommendationCard.tsx` — 推荐结果卡
- `ConfirmResetModal.tsx` — 重新摸底确认弹窗

**集成**：
- `app/csp-lecture/page.tsx` — 在 hero `<section>` 后插入 `<PlacementBanner />`

### 2.3 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 入口位置 | **/csp-lecture 顶部 banner** | 用户在课件页时最易看到；不打断 student/home 流程 |
| 问卷流程 | **单页长表单** | 5 题基础 + 4 区块 = 9 个交互元素，单页可承载；分步弹窗增加摩擦（v0 反馈）|
| 比赛成绩 | **模板化"最新一次"** | 学生关注最近成绩，历史数据信号噪声比差 |
| AI 失败 | **静默降级** | 等级 + 推荐用硬编码 fallback，AI 段显示"根据基础画像，暂未生成定制推荐"，不阻塞学生 |
| 重新摸底 | **允许 + 二次确认** | 复用 UPSERT 语义；明确告知会覆盖 |
| 推荐形态 | **紧凑卡片**（A 方案）| 等级 + 1 段点评 + 3 个课件链接；信息密度适合学生快速决策 |
| 等级映射 | **硬编码表 + LLM 校验**（C 方案）| GESP 5+ → intermediate 等映射表在 `csp-placement.ts`；LLM 二次校验防"初二 + GESP 8 级"极端组合 |
| 推荐输出 | **AI 同步 5s 软超时** | 客户端不阻塞；超 5s 返回 fallback + aiStatus='fallback'；后台继续跑 15s 写库 |
| 数据精度 | **比赛成绩"最新一次"** | 数组语义对 LLM 而言信息冗余；单条 latest 够用 |

## 3. 数据模型

### 3.1 新表 `csp_placement`

```sql
CREATE TABLE csp_placement (
  userId TEXT PRIMARY KEY,

  -- 基础画像（必填 5 题）
  grade TEXT NOT NULL,            -- '初一' | '初二' | '初三' | '高一' | '高二' | '高三'
  studyMonths TEXT NOT NULL,      -- 'lt3' | '3-6' | '6-12' | '12-24' | 'gt24'
  selfRating TEXT NOT NULL,       -- 'low' | 'mid' | 'high'
  goal TEXT NOT NULL,             -- 'pass-j1' | 'pass-j2' | 'high-rank' | 'try-best'
  hoursPerWeek TEXT NOT NULL,     -- 'lt2' | '2-5' | '5-10' | 'gt10'

  -- 比赛成绩（每项可为 null = 没参加或不愿填）
  province TEXT,                  -- 省份下拉
  cspJ1Year INTEGER, cspJ1Score INTEGER,
  cspS1Year INTEGER, cspS1Score INTEGER,
  cspJ2Year INTEGER, cspJ2Rank TEXT,  -- '省一'|'省二'|'省三'|'国一'|'国二'|'国三'
  cspS2Year INTEGER, cspS2Rank TEXT,
  gespYear INTEGER, gespLevel INTEGER, gespPassed INTEGER,  -- 0/1
  otherContests TEXT,             -- 自由文本

  -- AI 推荐输出
  level TEXT NOT NULL,            -- 'beginner' | 'intermediate' | 'advanced'
  recommendedIds TEXT NOT NULL,   -- JSON 数组 string: ["cm_xxx_v1", ...]
  aiReason TEXT,                  -- AI 文字点评（fallback 时为占位）
  aiStatus TEXT NOT NULL,         -- 'ok' | 'fallback'

  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_csp_placement_level ON csp_placement(level);
```

**迁移策略**：
- 在 `db.ts` 启动时 `CREATE TABLE IF NOT EXISTS csp_placement (...)`
- 不需要 backfill 旧数据（功能上线后才有新行）

### 3.2 `csp-placement.ts` 加 3 个新函数

```ts
// 文件: frontend/lib/server/csp-placement.ts

// CSP-J1 分数 → 等级映射（与 GESP/CSP-J2 复赛等级对齐）
export function scoreToLevelJ1(score: number): CspLevel;

// 综合等级：基础画像 + 比赛成绩一起评估。
// 规则：
//   - 有 CSP-J2 省一+ → 至少 advanced
//   - 有 GESP 6+ → 至少 intermediate
//   - 有 CSP-J1 历史过线（>=50 分）→ 至少 intermediate
//   - 其余按基础画像 selfRating
export function combinedLevel(answers: PlacementAnswers): CspLevel;

// Fallback 推荐：硬编码 3 个起点课件（当 LLM 调用失败时使用）
// 选取规则：选 csp-lecture collection 中覆盖"基础 → 真题"光谱的课件。
// 当前真实 csp-lecture 课件（2026-07-26 清单）：
//   - cm_imp_a39914d3af5c64d6  CSP初赛要点精讲 (16 scenes, 基础入门)
//   - cm_imp_cspj2024j_v1       2024年普及组CSP-J初赛真题卷 (6 scenes, 真题)
// 实施时若 csp-lecture collection 已有 8+ 课件，按下面映射重选：
//   beginner      → 精讲 1（基础语法/数据结构/位运算）
//   intermediate  → 精讲 3-4（算法基础/复杂度/字符串）
//   advanced      → 真题卷（限时模拟 + 错题回顾）
export const FALLBACK_RECOMMENDATIONS = {
  beginner: ['cm_imp_a39914d3af5c64d6'],
  intermediate: ['cm_imp_a39914d3af5c64d6', 'cm_imp_cspj2024j_v1'],
  advanced: ['cm_imp_cspj2024j_v1'],
};
```

### 3.3 评分映射参考表（嵌入 `csp-placement.ts`）

| 客观信号 | 等价等级 |
|----------|----------|
| CSP-J2 复赛省一/国一/国二/国三 | advanced |
| CSP-J2 复赛省二 | advanced |
| CSP-J2 复赛省三 | intermediate |
| CSP-S2 复赛省一/国一/国二/国三 | advanced（外加 cross） |
| CSP-S2 复赛省二/省三 | advanced |
| CSP-J1 历史过线（>= 50 分） | intermediate |
| GESP 通过 6-8 级 | intermediate（6-7）/ advanced（8） |
| GESP 通过 4-5 级 | beginner |
| 无比赛历史 | 基础画像 selfRating 决定 |

LLM prompt 会同时获得这 4 类信号，让 LLM 二次校验硬编码的结论。

## 4. API 设计

### 4.1 `GET /api/csp-quiz/placement`

**Auth**：required

**Response 200**：
```json
{
  "placement": {
    "userId": "u_xxx",
    "level": "intermediate",
    "recommendedIds": ["cm_csp1_v1", "cm_csp2_v1", "cm_quiz_v1"],
    "aiReason": "你 CSP-J 2024 拿了 42 分...",
    "aiStatus": "ok",
    "updatedAt": "2025-12-08T10:30:00Z",
    "answers": { /* 完整问卷答案（含比赛区块） */ }
  }
}
```

**Response 200 (无记录)**：`{ "placement": null }`

### 4.2 `POST /api/csp-quiz/placement`

**Auth**：required

**Body**：
```ts
{
  // 基础 5 题
  grade: string;
  studyMonths: 'lt3' | '3-6' | '6-12' | '12-24' | 'gt24';
  selfRating: 'low' | 'mid' | 'high';
  goal: 'pass-j1' | 'pass-j2' | 'high-rank' | 'try-best';
  hoursPerWeek: 'lt2' | '2-5' | '5-10' | 'gt10';

  // 比赛区块
  province?: string;
  cspJ1?: { year: number; score: number };
  cspS1?: { year: number; score: number };
  cspJ2?: { year: number; rank: '省一'|... };
  cspS2?: { year: number; rank: '省一'|... };
  gesp?: { year: number; level: 1-8; passed: boolean };
  otherContests?: string;
}
```

**流程**：
1. 校验 body（基础 5 题 + 比赛区块格式）
2. 计算 `level = combinedLevel(answers)`（用硬编码表）
3. UPSERT `csp_placement`，写入 `level + recommendedIds(空) + aiStatus='pending'`（**先返回 pending 给客户端**）
4. 调 LLM（5s 软超时）— 5s 内拿到就更新 `aiReason + recommendedIds + aiStatus='ok'`；超 5s 直接返回 pending 给客户端
5. LLM 在后台最多跑到 15s hard timeout，最终落库 `aiStatus='ok'` 或 `'fallback'`

**Response 200**：
```json
{
  "ok": true,
  "level": "intermediate",
  "recommendedIds": ["cm_csp1_v1", "cm_csp2_v1", "cm_quiz_v1"],
  "aiReason": "...",
  "aiStatus": "ok" | "fallback"
}
```

**Response 400**：`{ error: "基础 5 题缺一不可" }` 等
**Response 409**：`{ error: "已有进行中的摸底" }`（双开 modal 时返回）

## 5. 前端 UI

### 5.1 `PlacementBanner`（/csp-lecture 顶部）

**3 种状态**：

| 状态 | 视觉 | 交互 |
|------|------|------|
| **未摸底** | 金色渐变 banner + 紫色按钮"2 分钟摸底" | 点按钮 → 打开 PlacementModal |
| **已摸底** | 浅蓝渐变 banner + 等级徽章 + "查看推荐" + "重新摸底" | 点查看 → RecommendationCard；点重新摸底 → 二次确认 → PlacementModal |
| **加载中** | 骨架 placeholder | — |

**位置**：`app/csp-lecture/page.tsx` hero `<section>` 后、grid 前。

### 5.2 `PlacementModal`（**单页长表单**）

**布局**：

```
┌─────────────────────────────────────────────┐
│ ✕  CSP 初赛水平摸底                         │  ← 固定头部
├─────────────────────────────────────────────┤
│  📋 基础信息                                 │  ← 区块 1
│  年级      [初一▾]                            │
│  学多久    [3-6 个月▾]                       │
│  自评水平  [中级▾]                           │
│  目标      [通过 J1▾]                        │
│  每周小时  [2-5 小时▾]                       │
│                                              │
│  🏆 比赛成绩（可选）                         │  ← 区块 2
│  省份      [北京▾]                           │
│                                              │
│  CSP-J1 初赛                                │
│    状态  [2025▾]   (我没参加过 / 2025 / 2024) │
│    分数  [42]                                │
│  CSP-S1 初赛                                │
│    状态  [我没参加过▾]                       │
│  CSP-J2 复赛                                │
│    状态  [2024▾]                             │
│    等级  [省二▾]                              │
│  CSP-S2 复赛                                │
│    状态  [我没参加过▾]                       │
│  GESP 等级                                  │
│    状态  [2024▾]                             │
│    级别  [4▾]  [✓ 已通过]                    │
│  其它奖项                                    │
│    [蓝桥杯省二 2024]                         │
│                                              │
│  [查看我的推荐 →]                            │  ← 提交按钮
└─────────────────────────────────────────────┘
```

**关键交互**：
- 头部固定，body 可滚动
- 比赛区块的"状态"下拉是"我没参加过" / "2025" / "2024" / "2023" / "2022"（不显示更早）
- 选了"我没参加过"：分数/等级/级别字段隐藏
- 选了具体年份：对应字段展开
- 提交时基础 5 题未填 → 顶部黄条提示"基础 5 题为必填"
- 比赛区块字段全部可选，可不填直接提交

### 5.3 `RecommendationCard`

**布局**：
```
┌─────────────────────────────────────────────┐
│           📊 你的 CSP 初赛等级               │
│                                              │
│              [ 中级 ]                        │
│         42 分 / 100 分（42%）               │
│                                              │
│  你 CSP-J 2024 拿了 42 分，距离过线还差      │
│  8 分。基础语法扎实，建议从精讲 2（基础算法）│
│  开始。                                      │
│                                              │
│  📚 为你推荐                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 精讲 2   │ │ 精讲 3   │ │ 真题卷   │    │
│  │ 基础算法 │ │ 字符串   │ │ 2024     │    │
│  │  [开始 →]│ │  [开始 →]│ │  [开始 →]│    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                              │
│           [关闭]                             │
└─────────────────────────────────────────────┘
```

**fallback 状态**：AI 段显示"根据基础画像，暂未生成定制推荐"，但等级和推荐课件仍正常显示。

### 5.4 `ConfirmResetModal`

**布局**：
```
┌────────────────────┐
│ 重新摸底？          │
│                    │
│ 重新摸底会覆盖你   │
│ 当前的推荐。       │
│                    │
│ [取消] [重新摸底]  │
└────────────────────┘
```

## 6. 错误处理

| 场景 | 行为 | 兜底 |
|------|------|------|
| LLM 超时（>5s 软超时）| 立即返回 pending | 客户端展示硬编码 fallback 等级 + 推荐 |
| LLM 超时（>15s 硬超时）| 后台写 aiStatus='fallback' | 不影响客户端 |
| LLM 返回非 JSON | 静默降级 | aiStatus='fallback'，level 用硬编码 |
| LLM 429 限流 | 静默降级 | 同上 |
| LLM 字段缺失（无 level）| 用 LLM 返回的 recommendedIds + 硬编码 level | 推荐用 LLM 列表，level 用硬编码 |
| 客户端 5s 内 banner 还在 loading | 骨架 placeholder | 10s 后切 fallback "正在分析..." |
| 用户重复提交（双开 modal）| 第二份 POST 返回 409 | 弹 modal "已有进行中的摸底" |
| UPSERT 失败 | 500 错误 | 弹 modal 错误 "提交失败，请重试" |
| 基础 5 题缺一 | 400 错误 | 顶部黄条提示 |

## 7. 实施计划（6 个 task）

- Task 1: DB 加 `csp_placement` 表 + 增改 `lib/db.ts` 方法
- Task 2: `csp-placement.ts` 加 `scoreToLevelJ1` + `combinedLevel` + `fallbackRecommend` + 单测
- Task 3: `csp-placement-llm.ts`（新文件）+ prompt 工程 + 解析 + 超时
- Task 4: `GET/POST /api/csp-quiz/placement` 端点 + 单测
- Task 5: `PlacementBanner` / `PlacementModal` / `RecommendationCard` / `ConfirmResetModal` 组件
- Task 6: `app/csp-lecture/page.tsx` 集成 + 部署 + 手测

每个 task 5-7 个小步骤：写测试 → 跑测试 → 写实现 → 跑测试 → commit。

## 8. 测试

### 8.1 单元测试
- `csp-placement.test.ts` 加 `scoreToLevelJ1` + `combinedLevel` + `fallbackRecommend` case
- 目标：覆盖率 ≥ 80%

### 8.2 端点测试
- `placement/route.test.ts`（GET + POST 各 4 个 case）
  - 401 未登录
  - 200 无记录（GET）/ 200 创建新记录（POST）
  - 200 已有记录（GET）/ 200 更新现有记录（POST）
  - 400 缺基础 5 题
  - 409 重复提交
  - 200 LLM 失败 → fallback

### 8.3 e2e
- 跑 plan 阶段再加 e2e 任务清单

### 8.4 手测清单（部署后）
- 1. /csp-lecture 顶部 banner 显示"2 分钟摸底"
- 2. 点按钮 → PlacementModal 单页打开（5 题 + 4 区块都可见，可滚动）
- 3. 填基础 5 题 + 不填比赛区块 → 提交 → 5s 内拿到推荐
- 4. 比赛区块选"我没参加过" → 字段隐藏
- 5. 比赛区块选"2025" → 分数/等级字段展开
- 6. 重新摸底 → 二次确认 → 重新打开 modal
- 7. LLM 失败模拟（停 LLM API） → banner 仍显示等级 + 3 个 fallback 推荐，AI 段显示占位
- 8. 摸底后点 banner "查看推荐" → RecommendationCard 显示等级 + 点评 + 3 个推荐课件
- 9. 点推荐课件 → 进对应课件 + modal 自动关闭
- 10. 9 个老学生不摸底 → 排行榜/学员主页无变化（不影响现有 completed 状态）

## 9. 风险与备选

### 9.1 风险

| 风险 | 缓解 |
|------|------|
| LLM 调用费用（每个新学生 1 次）| 5s 软超时 + 静默降级；用项目 `getCurrentModelConfig()` 已配的便宜模型 |
| 比赛成绩自报不可信 | 仅作参考；不影响完成判定（`evaluateCompletion()` 不读 placement 表）|
| 重新摸底后推荐变化大 | 二次确认 modal 明确告知；学生可拒绝 |
| 单页长表单在手机上体验差 | responsive：< sm 单列，>= sm 2 列（基础 1 列 + 比赛 1 列）|
| 5 题 + 4 区块共 9 个交互元素，单页看着累 | 区块 2 比赛区块默认不强制填；4 区块每块都可独立点"我没参加过"跳过 |

### 9.2 推迟到下个 spec
- 教师管理端"强制摸底"开关
- 错题本联动（用 placement level 给错题难度排序）
- 摸底问卷 i18n
- 摸底 → 课件进度的"首次进入"引导动画

## 10. 与已实施 spec 的关系

- **复用 `csp-placement.ts`**（commit `dbe2468`，今天 push）：`scoreToLevel` + `levelLabel` 已在使用
- **复用 `csp-completion.ts`**（commit `4619e30`，今天 push）：0.5 阈值保持不变；本 spec 不动完成判定
- **复用 `csp-quiz/reset` 端点**（commit `8501456`，今天 push）：独立功能
- **复用 `evaluateCompletion()`**（不变）：摸底不影响学生"完成"语义
- **不冲突**：所有变更都是**增量**添加，不修改已完成的功能

---

**待用户 review**。如有要改的细节（比如 fallback 推荐具体哪 3 个课件 / 比赛区块字段命名 / LLM prompt 内容 / 静默降级文案），告诉我后改。
