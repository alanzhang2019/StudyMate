# StudyMate Monorepo 项目记忆

## 项目一句话
StudyMate（作业通，aijiangti.cn）— K12 AI 学习闭环的 monorepo。**三产品线共存**，不是单一"AI 数学错题机"。

## 三产品线

| 产品线 | 用户 | 入口 | 关键事实 |
|---|---|---|---|
| 小学 4-6 年级数学错题讲解 | 学生+家长 | `/mistake`、`/generation-preview` | MVP，backend 启发式诊断 + 前端 OpenMAIC 改造；端口 backend 3000 / frontend 3001 |
| CSP 真题训练 / 王牌战队2 | 信奥学生 | `/csp-lecture`、`/classroom/[id]` | 10 个学员按 A/B/C/D 梯队分组；第三方 Vjudge-AI-report C++ 接入已落地（subject='cpp', verdict ∈ AC/WA/TLE/RE/CE/MLE/PE） |
| 少年 AI 创造营 | 7-12 岁孩子 | `/camp`、`/camp/works`、`/camp/prepare` | `edu.xgteacher.cn`，Alan张老师个人品牌，工具栈 **Trae IDE + WorkBuddy**；2026-08-30 上线三张业务表（camp_students/camp_class_logs/camp_works）；作品走 `works.xgteacher.cn`；历史成绩 **2000+ 学员作品 / 15 年项目教学经验** |

## 关键事实

- 部署域名：aijiangti.cn（数学错题）；edu.xgteacher.cn（创造营）；**创造营页面已移除 ICP/公安备案公示与 XIAOGAO LAB 主体字样**，品牌资产 `xgls-*` 已统一重命名为 `alan-*`（/assets/alan-avatar.png、alan-logo.svg、class .alan-brand）；远程微信图 URL 同步改为 `https://edu.xgteacher.cn/assets/alan-avatar.jpg`（需在服务器侧重命名该文件）
- Nginx 配置：`/machine/* → 3000`、`/* → 3001`，全路径超时 600s（为 LLM+TTS+图像长链路）
- 开发流程：所有非平凡改动走 Superpowers（brainstorming → writing-plans → TDD → review → verify）；specs 落 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`；plans 落 `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
- 复用上游：OpenMAIC（AGPL-3.0），复用 shell/provider/workflow/deployment，**不**复用课堂生成的教学流式假设
- North-star：同类题纠错率
- 启发式规则 vs LLM：偏好 `规则 + 结构化抽取 + LLM` 混合链路
- CSP 真题卷走 QuizView 状态机：`not_started → answering → submitting → finalized`，含跨 6 scene 总分 + 重置
- 第三方接入：`POST /api/integrations/mistake` + `GET /api/integrations/jobs/{id}`，IP 限流（创建 10/min、轮询 120/min、重试 10/min）

## 易漏点（踩过的坑）

- backend/startup/runStartup.ts 默认 `FE_ROOT=D:\AItrade\AI-MATH-MISTAKE`，但当前仓库是 `D:\AItrade\ai-math-mistake-machine\frontend`，需要 `FE_ROOT` 环境变量覆盖
- 部署时必须把 `frontend/data/classrooms/*.json` 同步进 named volume 并 `chown nextjs:nodejs`，否则新课件看不见
- `backend/app/` 目录名是 Next.js App Router 风格但不一定被 Next.js 编译，是给前端 monorepo 共享用的占位组件
- "少年 AI 创造营"完全独立于"涌现智训 / Emergix"（涌现智训是 B 端企业培训，是另一个人设；少年 AI 创造营是 C 端 7-12 岁启蒙）
- **Next.js 15+ 动态路由 `params` 是 Promise**：App Router 的 `page.tsx` 和 `route.ts` handler 都必须 `await params`，否则 `[id]` 路由取到的 `id` 是 undefined，导致 findUnique 404。本项目已因此在 `admin/camp/works/[id]` 审核时报"作品不存在"。
- 少年 AI 创造营对外品牌统一为 **Alan张老师**（C 端 7-12 岁启蒙），代码里资产/类名已统一为 `alan-` 前缀；**勿再新增 `xgls-` 引用**，也勿在页面恢复 XIAOGAO LAB / 苏ICP备 / 苏公网安备 字样（用户已要求移除）。

## 记忆盲区提醒

下次梳理"产品矩阵"型项目前，先 grep 一遍产品关键字（品牌名、域名、备案号、学员名），再决定讲几条线，不能只看 SKILL.md/AGENTS.md 就认定项目范围。