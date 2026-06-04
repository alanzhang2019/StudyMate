# AI错题讲解机 SKILL 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `SKILL.md` 重构为 `AI错题讲解机` 的项目决策器 + 双轨评估器，并明确它与 `Superpowers` 流程 skill 的职责边界。

**Architecture:** 本次只改文档结构，不改业务代码。核心做法是整体重写 `SKILL.md` 的 frontmatter、角色定位、项目真相、判断规则、双轨评估与协作边界，使其成为项目判断 skill，而不是流程 skill 或 PRD。

**Tech Stack:** Markdown, workspace skill conventions, existing `Superpowers` workflow docs

---

## File Structure

- Modify: `d:\AItrade\ai-math-mistake-machine\SKILL.md`
  - 责任：把现有 skill 重构为“项目决策器 + 双轨评估器”
- Reference: `d:\AItrade\ai-math-mistake-machine\docs\superpowers\specs\2026-05-14-skill-redesign-design.md`
  - 责任：作为本次改写的唯一设计依据
- Reference: `d:\AItrade\ai-math-mistake-machine\AGENTS.md`
  - 责任：校验与 `Superpowers` 默认流程的协作边界

### Task 1: 整体重写 SKILL 结构

**Files:**
- Modify: `d:\AItrade\ai-math-mistake-machine\SKILL.md`
- Reference: `d:\AItrade\ai-math-mistake-machine\docs\superpowers\specs\2026-05-14-skill-redesign-design.md`

- [ ] **Step 1: 读取当前 skill 与设计稿，确认改写目标**

读取并对照以下内容：

```md
当前 skill 要保留的核心事实：
- 产品：AI错题讲解机
- 用户：4-6 年级学生，付费者为家长
- 学科：数学优先
- 终端：平板闭环 MVP 优先
- 核心闭环：拍题 -> 错因诊断 -> 儿童化讲解 -> 同类题验证 -> 错题本 -> 家长报告
- 北极星指标：同类题纠错率

重构后要新增的关键结构：
- Role
- Project Ground Truth
- Decision Rules
- Product Boundaries（Build now / Can build later / Do not build for MVP）
- Evaluation Framework（学习效果轨 + 产品交付轨）
- OpenMAIC Reuse Guidance
- Collaboration Rules
```

- [ ] **Step 2: 用重构后的 frontmatter 和章节骨架替换整个 `SKILL.md`**

将 `d:\AItrade\ai-math-mistake-machine\SKILL.md` 改写为以下完整结构：

```md
---
name: ai-math-mistake-machine
description: Guides scope, architecture, prioritization, OpenMAIC reuse, and evaluation decisions for the AI错题讲解机. Invoke when making product or technical decisions for this project.
---

# AI Math Mistake Machine

## Mission

This skill is the project decision-maker for `AI错题讲解机`.

Use it to make narrow, stable, testable decisions about:

- MVP scope
- architecture direction
- module priority
- `OpenMAIC` reuse
- evaluation design

This skill does **not** replace `brainstorming`, `writing-plans`, or implementation workflows. It provides the project judgment framework those workflows should follow.

## Role

This skill is responsible for:

- deciding what belongs in MVP now
- deciding what should be postponed
- evaluating architecture and reuse tradeoffs
- evaluating whether a design is measurable
- shaping learning-effect and product-delivery validation

This skill is not responsible for:

- replacing `brainstorming`
- replacing `writing-plans`
- replacing implementation plans
- replacing TDD or code execution workflows

## When To Use

- The user asks for MVP scope, PRD framing, feature boundaries, or page flow for `AI错题讲解机`
- The user asks for technical architecture, module design, API design, data model design, or system tradeoffs for this project
- The user asks what should be built now, postponed, or cut from MVP
- The user asks how to reuse, refactor, or avoid parts of `OpenMAIC`
- The user asks how to evaluate whether the product is working
- The user asks for milestone, prioritization, or feasibility decisions tied to this product

## Project Ground Truth

- Product: `AI错题讲解机`
- Primary users: grade 4-6 students
- Paying users: parents
- Subject focus: math first
- Device strategy: tablet-based closed MVP first; hardware learning machine later if validation succeeds
- Core loop: `拍题 -> 错因诊断 -> 儿童化讲解 -> 同类题验证 -> 错题本 -> 家长报告`
- North-star metric: `同类题纠错率`

Treat these as current default truths unless the user explicitly changes them.

## Decision Rules

When answering, always test the request against these questions:

1. Does this help the child fix one specific mistake class faster?
2. Can the parent understand the value immediately?
3. Is this needed for MVP now, or is it scope creep?
4. Can this be labeled, replayed, compared, and improved?
5. Does this reuse `OpenMAIC` correctly, or does it drag classroom baggage into the wrong product?

## Product Boundaries

### Build Now

- math only
- grades 4-6
- photo-based or text-based wrong-problem input
- wrong-cause diagnosis
- short child-friendly explanation
- 2-3 variant problems for validation
- mistake notebook
- parent-facing daily or weekly summary

### Can Build Later

- more refined diagnosis taxonomy
- stronger parent reporting
- OCR quality upgrades
- subject expansion after math validation
- hardware packaging after tablet MVP proves value

### Do Not Build For MVP

- all-subject support from day one
- open-ended chat tutoring
- large lesson generation
- classroom simulation or multi-agent teaching performance
- community/discovery feed
- full offline inference
- full custom hardware stack

## Technical Principles

1. Reuse the right layers of `OpenMAIC`.
Reuse shell, provider abstraction, workflow infrastructure, and deployment basics when they help.

2. Rebuild the core learning engine.
Do not force classroom-generation workflows to solve wrong-problem diagnosis.

3. Prefer hybrid logic over pure LLM freedom.
Use `rules + structured extraction + LLM`, not free-form model output only.

4. Optimize for evaluation.
Outputs should be easy to label, compare, replay, and improve.

5. Keep the loop short.
A single wrong-problem session should be quick, clear, and measurable.

## Evaluation Framework

Always think in two tracks.

### Learning Effect Track

Use this track to judge whether the product actually helps students correct mistakes:

- `同类题纠错率`
- `错因诊断准确率`
- `讲解后复做正确率`
- `复习后同知识点留存率`

### Product Delivery Track

Use this track to judge whether the product experience is usable and valuable:

- `拍题到结果耗时`
- `单次会话完成率`
- `儿童讲解可理解性`
- `家长报告可读性`
- `次日或次周回访率`

When giving evaluation advice, distinguish clearly between:

- `North-star`
- `Primary metrics`
- `Operational metrics`
- `Pass / fail threshold`

## OpenMAIC Reuse Guidance

When discussing `OpenMAIC`, separate recommendations into:

- Reuse directly
- Reuse with refactor
- Do not carry over

Default recommendation:

- Reuse directly: shell, provider abstraction, workflow infrastructure, config/deployment basics
- Reuse with refactor: streaming orchestration patterns, persistence adapters, shared utility layers
- Do not carry over: classroom content generation assumptions, long teaching flows, interactive classroom framing

## Collaboration Rules

Use this skill for project judgment.

Use `brainstorming` when the user wants to turn a rough idea into an approved design.

Use `writing-plans` when there is an approved design and the next step is implementation planning.

Use `test-driven-development`, `executing-plans`, `subagent-driven-development`, and the rest of the `Superpowers` workflow for implementation and verification work.

## Output Modes

Choose the most relevant mode based on the user request.

### Product Mode

Use sections like:

- Problem
- User
- Pain Today
- Core Loop
- MVP Scope
- Non-goals
- Success Signal
- Recommended Next Step

### Architecture Mode

Use sections like:

- Architecture Goal
- System Layers
- Core Services
- Workflow
- Data Model
- Deployment
- Risks

### Planning Mode

Use sections like:

- Goal
- Milestones
- Team Needs
- Dependencies
- Risks
- Recommended Sequence

### Evaluation Mode

Use sections like:

- What To Validate
- Learning Metrics
- Product Metrics
- Data Source
- Test Setup
- Pass/Fail Threshold
- Key Risks

## Guardrails

- Push back when the request is broad or unfocused
- Be explicit about what should be cut from MVP
- Distinguish clearly between `can build`, `should build now`, and `should postpone`
- Prefer narrow, testable recommendations over abstract vision
- When uncertain, state assumptions and keep the recommendation conservative
- Do not let this project drift into a general AI tutor without explicit user approval

## Example Requests

- “基于 OpenMAIC，写一版 AI错题讲解机 MVP PRD”
- “给我技术架构设计稿”
- “拆一下模块优先级和 8 周开发排期”
- “哪些模块应该复用，哪些应该重写”
- “设计学习效果和产品交付双轨评估指标”
```

- [ ] **Step 3: 检查新结构是否满足 spec，而不是只做内容平移**

逐项人工检查以下条件：

```md
- 是否新增了 Role
- 是否新增了 Project Ground Truth
- 是否新增了双轨 Evaluation Framework
- 是否新增了 OpenMAIC Reuse Guidance
- 是否新增了 Collaboration Rules
- Product Boundaries 是否改成 Build now / Can build later / Do not build for MVP
- 是否明确写出“不替代 brainstorming / writing-plans / TDD”
```

预期结果：以上 7 项全部满足，否则继续修改 `SKILL.md`。

- [ ] **Step 4: 检查文风是否符合“项目决策器”定位**

逐项人工检查以下标准：

```md
- 是否少了泛泛背景介绍
- 是否多了明确判断句
- 是否更强调 should build now / should postpone / should cut
- 是否避免把 skill 写成 PRD
- 是否避免把 skill 写成流程手册
```

预期结果：文风更像项目判断手册，而不是说明文。

- [ ] **Step 5: 提交本任务**

Run:

```bash
git add d:/AItrade/ai-math-mistake-machine/SKILL.md
git commit -m "docs: redesign project skill as decision and evaluation guide"
```

Expected: 生成只包含 `SKILL.md` 重构的提交。

### Task 2: 做结构验收与协作边界验收

**Files:**
- Modify: `d:\AItrade\ai-math-mistake-machine\SKILL.md`
- Reference: `d:\AItrade\ai-math-mistake-machine\AGENTS.md`
- Reference: `d:\AItrade\ai-math-mistake-machine\docs\superpowers\specs\2026-05-14-skill-redesign-design.md`

- [ ] **Step 1: 重新读取 `SKILL.md`，逐项比对设计稿要求**

重点比对以下要求：

```md
- 它是否在 30 秒内能看出“项目决策器 + 评估器”定位
- 它是否清楚区分项目判断与流程编排
- 它是否同时覆盖学习效果和产品交付两个视角
- 它是否仍然保持 AI错题讲解机 的 MVP 边界
- 它是否给 OpenMAIC 复用提供三分法
```

预期结果：以上 5 项全部能直接在文档中找到对应章节。

- [ ] **Step 2: 检查是否与 `AGENTS.md` 和 `Superpowers` 流程冲突**

逐项检查以下冲突点：

```md
- `SKILL.md` 是否要求跳过 brainstorming
- `SKILL.md` 是否要求跳过 writing-plans
- `SKILL.md` 是否要求跳过 TDD
- `SKILL.md` 是否试图自己接管完整开发流程
```

预期结果：以上 4 项全部为“否”。

- [ ] **Step 3: 如发现冲突，做最小修正**

若存在冲突，只允许修改如下类型内容：

```md
- 调整 Mission 中的职责边界句子
- 调整 Collaboration Rules 中的指向关系
- 调整 Guardrails 中可能越权的表述
```

预期结果：修正后 `SKILL.md` 与 `AGENTS.md` 保持协作，而非冲突。

- [ ] **Step 4: 完成最终人工验收**

按以下清单做最终确认：

```md
- 触发条件更清晰
- 项目事实更集中
- 判断规则更统一
- 边界判断更稳定
- 评估框架从单指标升级为双轨
- Superpowers 协作边界明确
```

预期结果：全部确认无误。

- [ ] **Step 5: 提交本任务**

Run:

```bash
git add d:/AItrade/ai-math-mistake-machine/SKILL.md
git commit -m "docs: validate redesigned skill boundaries"
```

Expected: 如果 Task 2 有修正内容，则产生结构验收提交；若无新增改动，则跳过提交并记录“验收通过，无额外修改”。
