# StudyMate / 作业通

StudyMate（作业通）是一款面向小学 4-6 年级的 AI 数学错题讲解应用。

它不是简单给答案的拍题工具，而是把一道错题变成一段可以跟着走的互动讲解流程：
- 拍照识别题目
- 判断学生易错点
- 生成分步骤讲解
- 配合语音播报与课堂式演示
- 让家长能看到是否真的学会了

## Product Positioning

- 目标人群：小学 4-6 年级学生与家长
- 核心场景：作业卡题、错题复盘、拍照后即时讲解
- 差异化：不直接给最终答案，强调过程理解、启发式讲解与讲后再练

## Current Capabilities

- 家长账号 + 多学生档案
- 学生拍照上传数学题
- OCR 识别与题目确认
- AI 生成讲解预览页
- TTS 语音讲解
- 课堂内容持久化与历史查看
- 管理端全局语音设置

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma + SQLite
- NextAuth.js
- Zustand
- OpenMAIC runtime pieces reused where they help generation, providers, and classroom workflow

## Local Development

### Prerequisites

- Node.js >= 20
- pnpm >= 10

### Install

```bash
pnpm install
```

### Environment

Create `.env.local` and make sure these values are set correctly:

```env
DATABASE_URL="file:d:/AItrade/AI-MATH-MISTAKE/prisma/dev.db"
AUTH_SECRET="your-secret"
AUTH_URL="http://localhost:3001"
```

Important notes:
- `DATABASE_URL` must use an absolute path on Windows
- `AUTH_SECRET` and `AUTH_URL` must both exist
- `.env.local` comment lines must stay on their own lines

### Run

```bash
pnpm dev
```

Then open [http://localhost:3001](http://localhost:3001).

## Main Routes

- `/mistake`：学生拍题入口
- `/generation-preview`：讲解生成预览
- `/select-profile`：学生档案选择
- `/history`：历史记录
- `/admin/settings`：全局语音设置

## Repository Goal

This repository is the active codebase for the StudyMate / 作业通 product line. Branding, visible UI copy, and product-facing documentation should reflect the StudyMate identity.
