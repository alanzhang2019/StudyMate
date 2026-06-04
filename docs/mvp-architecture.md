# MVP Architecture

## Architecture Goal

先搭一个可验证的错题诊断后端骨架，满足以下目标：

- 单次错题会话可以快速返回结构化诊断结果
- 输出能被标注、回放和评估
- 后续可以平滑接入 OCR、LLM、错题本与家长报告

## System Layers

### 1. Input Layer

输入来源暂分两类：

- `photo`：未来接 OCR 识别
- `manual`：当前开发期用文本录入替代拍题

### 2. Normalization Layer

把题目文本、学生答案、正确答案整理成统一输入：

- 清洗空格与符号
- 提取明显提示词
- 识别基础算术特征

### 3. Diagnosis Layer

MVP 用启发式规则判断错因，不直接依赖自由生成：

- `carry_mistake`：进位错误
- `borrow_mistake`：退位错误
- `operator_confusion`：运算符混淆
- `bracket_order_error`：括号或运算顺序错误
- `unit_conversion_error`：单位换算错误
- `concept_gap`：概念理解不足

后续升级路径：

- 规则召回候选标签
- 结构化抽取题型、知识点、步骤差异
- LLM 负责解释、排序与讲解生成

### 4. Explanation Layer

输出面向儿童的短讲解，要求：

- 只解释当前一道题
- 语言短、具体、可执行
- 给出下一步同类题验证建议

### 5. Reporting Layer

先返回家长摘要字段，后续再接数据库：

- 本次错因
- 当前需要复习的知识点
- 下一步建议

## Core Services

- `taxonomy service`：维护错因标签及说明
- `diagnosis workflow`：执行标准化、规则判断和讲解生成
- `session route`：暴露 HTTP 接口
- `report formatter`：组装儿童版与家长版输出

## Workflow

1. 接收题目文本与答案
2. 标准化输入
3. 根据关键词和答案差异匹配错因
4. 生成儿童化讲解
5. 生成 2 道同类验证题
6. 返回结构化 session 结果

## Data Model

核心实体：

- `ProblemInput`
- `DiagnosisResult`
- `PracticeSuggestion`
- `ParentSummary`

设计原则：

- 字段尽量结构化，方便后续评估与落库
- 保留 `confidence`，便于人工复核和模型排序
- 标签值稳定，不和展示文案强耦合

## Deployment

当前阶段：

- 单体 Node.js 服务
- TypeScript 开发
- 先无数据库

后续拆分建议：

- OCR 服务
- 诊断编排服务
- 会话与报告存储服务

## Risks

- 只有启发式规则时，题型覆盖率有限
- 没有 OCR 时，真实拍题链路尚未打通
- 没有持久化时，无法形成真实错题本
- 没有评测集时，难验证 `同类题纠错率`

## Recommended Sequence

1. 先完成文本输入版诊断 API
2. 再补 OCR 接入层
3. 加入错因标注集与评估脚本
4. 再接家长报告与错题本存储
