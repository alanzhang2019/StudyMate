# AI错题讲解机 SKILL 重构设计

> 目标对象：`d:\AItrade\ai-math-mistake-machine\SKILL.md`
> 日期：`2026-05-14`
> 类型：项目级 skill 重构设计

## 背景

当前 `SKILL.md` 已经具备较清晰的产品边界、技术原则和输出模式，作为项目方向约束是有效的。

但在项目已接入 `Superpowers` 的前提下，这份 skill 还有三个结构性问题：

1. 它更像“产品说明书”，但还不够像“项目判断器”
2. 它和 `brainstorming`、`writing-plans` 等流程 skill 的职责边界没有明确写出来
3. 它强调了北极星指标 `同类题纠错率`，但没有形成完整的双轨评估框架

因此，这次不是做措辞润色，而是把它重构成：

`AI错题讲解机的项目决策器 + 双轨评估器`

## 重构目标

重构后的 skill 需要满足以下目标：

1. 在讨论 `MVP 范围 / 架构取舍 / OpenMAIC 复用 / 模块优先级 / 评估方式` 时，能快速给出稳定、一致、可执行的判断
2. 明确说明它不替代 `Superpowers` 的流程型 skill，而是为这些 skill 提供项目上下文与判断标准
3. 从“单一北极星指标”升级为“学习效果 + 产品交付”的双轨评估框架
4. 降低 downstream agent 在项目扩张、需求漂移、架构误用上的概率

## 非目标

本次重构不追求以下内容：

- 不把这份 skill 变成完整 PRD
- 不把这份 skill 变成实施计划
- 不在 skill 里嵌入详细 API、数据库 schema 或页面线框
- 不让这份 skill 接管 `brainstorming`、`writing-plans`、`test-driven-development` 的流程职责

## 建议角色定位

重构后的 `SKILL.md` 定位为：

`AI错题讲解机项目的高优先级项目判断器`

它主要回答五类问题：

1. 这是不是 `MVP 现在该做的`
2. 这件事是否真正提升“纠正一类具体错误”的效率
3. 这项设计是否正确复用 `OpenMAIC`
4. 这项方案是否可评估、可标注、可迭代
5. 这项设计在学习效果和产品交付上分别如何验证

## 与 Superpowers 的职责边界

这是本次重构最重要的新增内容。

重构后的 skill 应明确：

- 它负责 `项目判断`
- 它不负责 `流程编排`

推荐写清楚以下协作关系：

- 当用户在讨论产品范围、架构方向、优先级、评估指标时，优先使用本 skill
- 当用户要求开始形成具体设计、输出 spec、进入实现分解时，由 `brainstorming` 和 `writing-plans` 接管流程
- 当用户要求实现功能或修 bug 时，仍遵循 `AGENTS.md` 里的 `Superpowers` 默认流程

这样可以避免出现两个问题：

- 项目 skill 与流程 skill 抢控制权
- agent 把这份项目 skill 当成完整开发流程来执行

## 建议的新结构

建议将 `SKILL.md` 重构为以下结构。

### 1. Frontmatter

目标：

- 强化“这是什么 skill”
- 强化“什么时候调用”
- 让描述更贴近“项目判断器 + 评估器”

建议描述重点包含：

- 它服务于 `AI错题讲解机`
- 它用于 `范围 / 架构 / 优先级 / 评估`
- 它应在涉及该项目方向判断时触发

### 2. Mission

用更直接的一段话说明：

- 该 skill 的任务不是泛化 brainstorming
- 该 skill 的任务是为 `AI错题讲解机` 提供稳定、保守、可评估的项目决策

### 3. Role

新增专门章节，明确两组边界。

负责：

- MVP 边界判断
- 架构取舍判断
- `OpenMAIC` 复用判断
- 功能优先级判断
- 双轨评估设计

不负责：

- 替代 `brainstorming`
- 替代 `writing-plans`
- 替代实施计划
- 替代代码实现与 TDD

### 4. Project Ground Truth

保留并强化最关键的产品事实：

- 用户：4-6 年级学生，付费者为家长
- 学科：数学优先
- 终端：平板闭环 MVP 优先
- 核心闭环：`拍题 -> 错因诊断 -> 儿童化讲解 -> 同类题验证 -> 错题本 -> 家长报告`
- 北极星指标：`同类题纠错率`

该部分应被表述为“当前默认真相”，不是可随意漂移的背景资料。

### 5. Decision Rules

把当前 `Default Assumptions`、`Technical Principles`、`Guardrails` 整合为更强的判断规则。

推荐采用一组固定问题：

1. 是否帮助孩子更快纠正一类具体错误
2. 家长是否能立即感知价值
3. 是否属于 MVP 现在必须做的能力
4. 是否能被标注、回放、比较和优化
5. 是否正确复用 `OpenMAIC`，而不是把课堂生成包袱带进来

这样可减少 skill 内多段重复表达。

### 6. Product Boundaries

保留 `In scope / Out of scope`，但建议改成更稳定的判断写法：

- `Build now`
- `Can build later`
- `Do not build for MVP`

这样比单纯的 in/out scope 更适合决策场景。

### 7. Evaluation Framework

这是本次重构的核心新增章节。

需要显式拆为双轨：

#### 学习效果轨

用于验证产品是否真正帮助学生纠错：

- 同类题纠错率
- 错因诊断准确率
- 讲解后复做正确率
- 复习后同知识点留存率

#### 产品交付轨

用于验证产品是否能顺利被使用并感知到价值：

- 拍题到返回结果耗时
- 单次会话完成率
- 儿童讲解可理解性
- 家长报告可读性
- 次日或次周回访率

同时建议要求回答中区分：

- `North-star`
- `Primary metrics`
- `Operational metrics`
- `Pass / fail threshold`

### 8. Output Modes

保留原来的四种模式，但让它们更有执行性：

- `Product Mode`
- `Architecture Mode`
- `Planning Mode`
- `Evaluation Mode`

其中 `Evaluation Mode` 应强制更完整输出：

- What To Validate
- Learning Metrics
- Product Metrics
- Data Source
- Test Setup
- Pass/Fail Threshold
- Key Risks

### 9. OpenMAIC Reuse Guidance

单独保留一节，明确三分法：

- 可以直接复用什么
- 需要改造后复用什么
- 不应带入什么

这样比散落在多段里更利于后续调用。

### 10. Collaboration Rules

新增一节，显式说明与 `Superpowers` 的协作方式：

- 本 skill 提供项目判断框架
- `brainstorming` 负责把需求收敛成设计
- `writing-plans` 负责把设计拆成实施计划
- `test-driven-development` 负责实现阶段的质量纪律

## 内容风格建议

重构后的文本应遵循以下风格：

- 比当前更像“决策手册”，少一些泛泛背景介绍
- 句子更短、更硬，减少解释性废话
- 多使用 `should build now / should postpone / should cut`
- 多使用可验证表达，少使用抽象愿景表达
- 避免让 skill 像 PRD 或像开发计划

## 风险

### 风险 1：写得过重

如果加入过多流程说明，容易和 `Superpowers` 原生 skill 冲突。

控制方法：

- 只定义“何时交给哪个流程 skill”
- 不复写流程细节

### 风险 2：评估章节写成数据平台方案

如果写得过深，会让一个项目 skill 失焦。

控制方法：

- 只定义指标框架、验证目标和阈值思路
- 不写复杂埋点或实验平台实现

### 风险 3：仍然保留旧结构包袱

如果只是加段落、不改骨架，最后仍然会像“增强版”，而不是“重构版”。

控制方法：

- frontmatter、角色、评估、协作边界都整体重写

## 验收标准

重构后的 `SKILL.md` 应满足以下标准：

1. 读者能在 30 秒内理解它是“项目决策器 + 评估器”
2. 读者能明确知道它不替代 `Superpowers` 的流程 skill
3. 它能对 `MVP 范围 / 架构取舍 / OpenMAIC 复用 / 评估设计` 提供一致判断
4. 它能覆盖学习效果和产品交付两个验证视角
5. 它比当前版本更利于 downstream agent 做保守、聚焦、可测的判断

## 推荐下一步

在你确认本设计后，下一步不是直接“边改边想”，而是：

1. 按本 spec 重写 `SKILL.md` 的整体结构
2. 做一次结构自检，确认没有和 `Superpowers` 流程 skill 抢职责
3. 再进入实施计划或直接进行文档改写
