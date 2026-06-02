# [OPEN] generation-latex-slow

## 症状

- 课件生成速度明显偏慢。
- 页面中出现用户看不懂的原始分数写法，例如 `\frac{1}{2}`、`\frac{5}{6}`，而不是统一渲染后的数学表达。
- 用户要求先分析原因，再尽可能对比官方 OpenMAIC 后修改。

## 复现范围

- 主工作区：`D:\AItrade\AI-MATH-MISTAKE`
- 相关页面：`/generation-preview`、`/classroom/...`

## 当前假设

1. 生成速度慢是因为当前 mistake 流程额外串行做了多轮 outline / scene 生成或重试，而官方路径更短。
2. 原始 `\frac{}` 泄露是因为某些文本节点走了普通字符串渲染，未进入统一的数学排版组件或 KaTeX 处理链。
3. 当前项目在 prompt / post-process / scene 渲染之间存在不一致，导致同一页里部分分数被渲染、部分仍保留原始 LaTeX。
4. 生成页慢并不完全来自模型速度，而是前端轮询、等待策略或服务端串行 orchestration 比官方更保守。
5. 官方 OpenMAIC 对数学文本的渲染入口更集中，而当前项目在 mistake 场景里新增了一条旁路，绕过了官方渲染约定。

## 调试计划

1. 对照官方 OpenMAIC 的生成链路与数学文本渲染入口。
2. 读取当前项目的 mistake 生成链、preview 页、classroom 渲染链。
3. 如静态证据不足，再只加最小埋点，记录生成各阶段耗时与数学文本进入渲染器前后的内容。
4. 收敛根因后再用 TDD 落修复。
