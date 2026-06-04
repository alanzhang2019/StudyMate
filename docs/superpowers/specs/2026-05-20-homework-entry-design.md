# AI错题讲解机 作业入口版前端设计

> 日期：`2026-05-20`
> 范围：`/mistake` 学生主入口、识别确认、处理中转、讲解结果承载、验证页、验证结果页、我的题、给家长看
> 类型：前端体验与信息架构设计

## 背景

当前项目已经具备一条可运行的错题链路：

- `拍题 / OCR`
- `mistake session`
- `generation-preview`
- `classroom`
- `TTS 声音播放`

但这条链路对学生呈现出来的产品形态仍然偏 `OpenMAIC` 通用课堂模式，和“学生写作业时卡住一道数学题，拍一下，先讲清楚，再验证会没会”的目标场景不完全一致。

这次设计的目标不是推翻现有生成与播放基础设施，而是把学生面前看到的产品形态，重构为更贴近 `作业卡题 -> 讲解 -> 验证 -> 记录 -> 家长可复述结果` 的首版体验。

## 设计目标

本次前端设计需要同时满足以下目标：

1. 让学生一眼理解这是“解决当天作业卡题”的工具，而不是通用 AI 课堂入口
2. 让主流程尽可能短：`拍题 -> 识别确认 -> 讲解 -> 验证`
3. 不直接给答案，而是突出“先讲清楚，再看会不会做”
4. 复用现有 `generation-preview` 与 `classroom` 技术链路，不额外分叉新的讲解引擎
5. 为首版保留轻量的 `我的题` 与 `给家长看` 页面，但不引入复杂统计或知识诊断后台

## 非目标

本次设计不包含以下内容：

- 不重做整套 `OpenMAIC` 通用首页
- 不在首版引入多题验证、题组训练或复杂难度分层
- 不做复杂家长数据分析看板
- 不要求后端一次性返回完全成熟的结构化诊断模型
- 不在首版把 `classroom` 从技术上拆成一套全新的学生讲解播放器

## 已确认边界

以下边界已经在设计讨论中确认：

1. `作业入口版` 主入口挂在 `/mistake`
2. `/` 现有通用首页暂时保留，不在本次改造范围
3. 讲解结果首版继续沿用现有 `classroom` 技术链路承载
4. `我的题` 与 `给家长看` 首版都做轻量可用版
5. 验证页首版只做 `1` 道同类题

## 方案选择

本次采用以下落地策略：

### 方案 B：流程壳层 + 复用现有链路

核心思想：

- 把 `/mistake` 改造成真正的学生主入口
- 保留 `/generation-preview` 作为处理中转页
- 保留 `/classroom/[id]` 作为讲解结果承载页
- 新增轻量的验证与记录页

### 选择理由

相较于“完全新壳层重做”或“只改文案不改结构”，该方案具有更好的平衡：

- 能快速形成 `作业入口版` 产品形态
- 最大化复用现有 `mistake -> preview -> classroom` 链路
- 不会把当前已打通的 TTS / classroom 续跑逻辑再次打散
- 便于后续分阶段把 `classroom` 外层继续学生化，而不是一次性重写

## 页面与路由骨架

### 1. `/mistake`

角色：

- 学生主入口页

页面职责：

- 解释这是用来解决“作业不会做”的入口
- 提供拍题上传主 CTA
- 提供查看“今天做过的题”的次 CTA
- 展示轻量价值点和上传建议

### 2. `/mistake/recognize`

角色：

- OCR 识别确认页

页面职责：

- 展示识别后的题干、学生答案、正确答案候选
- 让学生确认识别是否正确
- 提供重新上传和继续讲解入口

### 3. `/generation-preview`

角色：

- 处理中转页

页面职责：

- 表达“正在看这道题 / 正在准备讲解”
- 不承担讲解结果表达
- 只负责处理状态、加载与进入讲解页

### 4. `/classroom/[id]`

角色：

- 讲解结果承载页

页面职责：

- 延续现有课堂播放与声音链路
- 外层 UI 改造成“作业讲解结果页”视角
- 固定使用四卡片结构展示讲解摘要

### 5. `/quiz/[id]`

角色：

- 验证页

页面职责：

- 承载首版 1 道同类题验证
- 提供提交答案与返回讲解入口

### 6. `/quiz-result/[id]`

角色：

- 验证结果页

页面职责：

- 展示“已基本会了”或“还容易卡住”两类反馈
- 引导继续拍题或回看讲解

### 7. `/history`

角色：

- 我的题

页面职责：

- 展示今天做过的题
- 以轻量状态分组展示“还要再练 / 已经会了”
- 提供“再看讲解 / 再练一题”入口

### 8. `/parent/[id]`

角色：

- 给家长看

页面职责：

- 以 3-4 条摘要描述本次结果
- 强调“会了没有”，不强调“学了多久”

## 页面低保真结构

### `/mistake` 作业入口首页

```text
顶部轻导航
  返回 / 品牌弱化 / 历史入口

主标题
  作业不会做，拍一下马上讲明白

副标题
  不会直接只给答案，会一步一步讲清楚这题该怎么想。

主按钮
  [拍一道作业题]

次按钮
  [看看今天做过的题]

价值点区
  - 先讲思路，再看会不会做
  - 讲完再练 1 题，确认真的学会
  - 做过的题会自动帮你记住

上传提示区
  支持拍作业、练习册、试卷上的单道数学题
  尽量一次只拍一道题，讲解更准确

页底弱提示
  给家长看的不是“讲了多少”，而是“这类题会了没有”
```

### `/mistake/recognize` 识别确认页

```text
页头
  先确认一下题目

题目图片区
  原图 / 裁切后图

识别结果区
  题干
  学生答案
  正确答案候选

操作区
  [识别正确，继续]
  [识别有误，重新上传]

异常态
  这次没有看清楚题目
  [重新拍题]
  [返回首页]
```

### `/generation-preview` 处理中转页

```text
状态图形 / 动画

标题
  正在看这道题……

说明
  先帮你找出它在考什么，再用容易懂的方法讲清楚。

步骤提示
  识别题目
  分析卡点
  生成讲解
  准备进入讲解页
```

### `/classroom/[id]` 讲解结果承载页

```text
页头
  这题我来陪你一起弄明白
  这道题刚刚卡住了，先别急，我们一步一步来。

四卡片固定区
  卡片1：你卡住的地方
  卡片2：为什么会卡住
  卡片3：这题该怎么想
  卡片4：下次遇到时记住

讲解补充区
  还是有点不懂，再讲简单一点
  有帮助 / 没帮助

底部主操作
  [我懂了，做 1 道同类题]

底部弱提示
  会不会，不是看现在点头，而是看下一题能不能做对
```

### `/quiz/[id]` 验证页

```text
页头
  试一题，看看是不是真的会了

副标题
  刚刚那道题听懂了，再做 1 道同类题试试看。

题目卡片
  第 1 题
  提示：这题和刚才很像，先自己想一想。

答题区
  输入答案 / 选择答案

操作区
  [提交答案]
  [回看刚才的讲解]

页底鼓励
  做错没关系，现在发现问题，比下次作业再错更好
```

### `/quiz-result/[id]` 验证结果页

```text
成功态
  做得不错，这类题你已经基本会了
  [继续拍一道题]
  [加入我的已掌握]

失败态
  这类题你还容易卡住
  [回看讲解]
  [换个讲法再讲]
```

### `/history` 我的题

```text
页头
  今天做过的题

分组
  还要再练
  已经会了

题目卡片
  题目摘要
  最近状态
  [再看一遍讲解]
  [再练一题]

空状态
  今天还没有做过的题
  遇到作业不会的题，拍一下就能开始
```

### `/parent/[id]` 给家长看

```text
页头
  给家长看

摘要卡片
  今天一共处理了 {count} 道题
  已经讲明白并做对了 {count} 道
  还需要再练的主要是：{reason}
  建议重点关注：{topic}

页底提示
  我们更关注“这类题会了没有”，不是“今天做了多久”
```

## 前端结构化字段

### 首页视图模型

```ts
type HomeworkHomeViewModel = {
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
```

### 识别确认视图模型

```ts
type RecognizeConfirmViewModel = {
  imageUrl: string;
  problemText: string;
  studentAnswer?: string;
  correctAnswerCandidate?: string;
  confidence: number;
  needsUserConfirmation: boolean;
};
```

### 讲解结果摘要模型

首版结果页禁止直接依赖任意长自由文本铺满页面，统一映射为固定四块：

```ts
type ExplanationSummary = {
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
```

### 验证题模型

```ts
type QuizQuestion = {
  id: string;
  title: string;
  hint: string;
  stem: string;
  type: 'input' | 'single-choice';
  options?: Array<{ id: string; label: string }>;
};
```

### 验证结果模型

```ts
type QuizResultSummary = {
  passed: boolean;
  explanationRefId: string;
  retryAvailable: boolean;
};
```

### 我的题列表项模型

```ts
type HomeworkHistoryItem = {
  id: string;
  problemPreview: string;
  status: 'pending' | 'done';
  updatedAt: number;
  explanationId: string;
};
```

### 家长摘要模型

```ts
type ParentSummary = {
  totalCount: number;
  solvedCount: number;
  needMoreReason: string;
  focusTopic: string;
};
```

## 与现有链路的映射

### 直接复用的部分

以下链路在本次设计中继续复用：

- `/mistake` 的拍题上传、OCR、创建 mistake session
- `generationSession` 的写入与传递
- `/generation-preview` 的处理中转角色
- `/classroom/[id]` 的页面承载、讲解续跑与声音播放
- 已打通的服务端 TTS / VoxCPM 声音链

### 需要新增的前端适配层

为实现作业入口版产品形态，新增或改造以下前端层：

1. `/mistake` 的首页化 UI 壳层
2. 独立的 `/mistake/recognize` 识别确认页面
3. `/classroom/[id]` 外层“结果页视角”容器
4. `/quiz/[id]` 与 `/quiz-result/[id]` 页面
5. `/history` 与 `/parent/[id]` 轻量页面
6. 从讲解完成进入验证页的显式跳转逻辑

### 建议补齐的最小结构化数据

长期建议后端或 session 层输出：

```ts
type MistakeExplanationPayload = {
  explanationSummary: ExplanationSummary;
  quiz?: QuizQuestion;
  parentSummary?: ParentSummary;
};
```

### 过渡方案

如果后端暂时无法直接返回 `ExplanationSummary`，首版允许在前端增加一层过渡适配：

- 从现有讲解文本中提取四块摘要字段
- 该适配层仅作为临时兼容
- 长期接口目标仍然是结构化返回

## i18n 设计

### 原则

用户已提供完整作业入口版文案及推荐 key，但当前项目已经存在大量通用 `OpenMAIC` 首页与课堂 key。

为了避免语义冲突，首版不直接复用通用命名空间，而采用独立的作业入口命名空间。

### 推荐命名空间

- `homeworkHome.*`
- `homeworkUpload.*`
- `homeworkLoading.*`
- `homeworkRecognize.*`
- `homeworkResult.*`
- `homeworkQuiz.*`
- `homeworkQuizResult.*`
- `homeworkHistory.*`
- `homeworkParent.*`
- `homeworkCommon.*`

### 设计理由

这样处理有三个好处：

1. 不污染现有 `app/page.tsx` 的通用 `home.*` 语义
2. 不与 `generation-preview`、`classroom` 既有 key 混用
3. 允许 `/mistake` 这条产品线独立演进

### 落地建议

- 以用户给出的 key 作为文案源
- 实际代码落地时映射为当前项目更安全的命名空间
- 如果未来 `/mistake` 成为唯一主入口，再评估统一 key 收敛

## 页面级实现建议

1. 结果页固定为四个摘要卡片区块，不允许后端直接返回任意长正文让前端平铺
2. `/generation-preview` 继续做处理中转，不承担结果表达
3. 验证页首版只做 1 题，以降低心理压力和前端复杂度
4. `history` 与 `parent` 都优先静态结构和轻量真实数据，不引入复杂图表
5. `classroom` 对学生的产品心智从“课堂播放器”切换为“讲解结果页”

## 测试与验收关注点

### 前端体验验收

- 学生进入 `/mistake` 后，能明确理解这是作业卡题入口
- OCR 识别后，能清晰完成确认与重新上传
- 讲解页能稳定展示四块核心讲解摘要
- 学生能从讲解页自然进入 1 道同类题验证
- 轻量 `history` 与 `parent` 页面具有可用空状态与基础真实内容

### 技术验收

- 不破坏现有 `mistake -> generation-preview -> classroom` 主链路
- 不新增客户端直传 `ttsBaseUrl / ttsApiKey` 到服务端
- 不让 `generation-preview` 再承担学生结果页职责
- 不让 `classroom` 内部声音链、续跑逻辑与本次学生化外壳强耦合

## 风险与后续议题

### 当前风险

1. 如果后端不补结构化字段，前端四卡片摘要提取会带来临时适配成本
2. 继续沿用 `classroom` 承载讲解结果，可能保留部分“课堂播放器”遗留心智
3. `history` 与 `parent` 轻量页如果没有最小真实数据支撑，容易沦为空壳

### 后续建议文档

下一阶段建议继续补齐以下文档：

- 讲解结果页后端返回 JSON 结构
- 验证页题目数据结构
- 页面级埋点事件表
- 错因标签与对应讲解模板
