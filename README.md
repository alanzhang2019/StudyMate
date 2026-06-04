# AI Math Mistake Machine

`AI错题讲解机` 的最小开发起步版本。

当前仓库按 `SKILL.md` 的边界启动开发，目标不是做泛化 AI 家教，而是先把一条可评估的错题诊断闭环跑起来：

`拍题/录题 -> 错因诊断 -> 儿童化讲解 -> 同类题验证 -> 错题本 -> 家长报告`

## 当前范围

- 学科：数学
- 年级：4-6 年级
- 产品形态：先做平板闭环 MVP
- 本阶段重点：后端诊断工作流骨架与结构化输出

## 目录

- `docs/mvp-architecture.md`：MVP 架构与开发边界
- `docs/superpowers`：按 Superpowers 规范沉淀的设计与实施文档
- `src/domain`：核心领域模型
- `src/data`：错因标签与启发式规则
- `src/workflows`：诊断工作流
- `src/routes`：HTTP 路由
- `tests`：核心工作流测试
- `.trae/skills`：已安装的 Superpowers 核心 skills

## 开发流程

当前仓库已接入 `Superpowers` 核心技能与约定，默认开发顺序为：

`brainstorming -> writing-plans -> test-driven-development -> implementation -> requesting-code-review -> verification-before-completion`

项目级约束见 `AGENTS.md`。

## 启动方式

```bash
npm install
npm run dev
```

服务默认监听 `http://localhost:3000`。

## API

### `GET /health`

健康检查。

### `POST /api/session/analyze`

请求体示例：

```json
{
  "grade": 4,
  "subject": "math",
  "source": "manual",
  "problemText": "小明做题：36+27=53，我总是忘记进位",
  "studentAnswer": "53",
  "correctAnswer": "63"
}
```

返回值会给出：

- 标准化后的题目信息
- 猜测错因标签
- 儿童化讲解
- 建议的 2 道同类题
- 面向家长的简短摘要

## 下一步建议

- 接入 OCR，把 `problemText` 从图片识别结果自动生成
- 把启发式错因规则替换成 `规则 + 结构化抽取 + LLM` 混合链路
- 增加错题本与家长报告的数据持久化
