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
