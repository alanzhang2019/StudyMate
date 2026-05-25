# StudyMate / 作业通

StudyMate（作业通）是一款面向小学 4-6 年级的 AI 数学错题讲解应用。

它不是简单给答案的拍题工具，而是把一道错题变成一段可以跟着走的互动讲解流程：
- 拍照识别题目
- 找出学生可能的易错点
- 生成分步骤讲解
- 配合语音播报与课堂式演示
- 帮助家长判断是否真的学会

## 产品定位

- 目标人群：小学 4-6 年级学生与家长
- 核心场景：作业卡题、错题复盘、拍照后即时讲解
- 差异化：不直接给最终答案，强调过程理解、启发式讲解与讲后再练

## 当前能力

- 家长账号 + 多学生档案
- 学生拍照上传数学题
- OCR 识别与题目确认
- AI 生成讲解预览页
- TTS 语音讲解
- 课堂内容持久化与历史查看
- 管理端全局语音设置

## 技术栈

- Next.js App Router
- TypeScript
- Prisma + SQLite
- NextAuth.js
- Zustand
- 在生成链路、Provider 抽象与课堂工作流上复用部分 OpenMAIC 能力

## 本地开发

### 环境要求

- Node.js >= 20
- pnpm >= 10

### 安装

```bash
pnpm install
```

### 环境变量

创建 `.env.local`，并确保以下关键项正确：

```env
DATABASE_URL="file:d:/AItrade/AI-MATH-MISTAKE/prisma/dev.db"
AUTH_SECRET="your-secret"
AUTH_URL="http://localhost:3001"
```

注意：
- Windows 下 `DATABASE_URL` 必须使用绝对路径
- `AUTH_SECRET` 与 `AUTH_URL` 缺一不可
- `.env.local` 里的注释必须单独占一行

### 启动

```bash
pnpm dev
```

然后打开 [http://localhost:3001](http://localhost:3001)。

## 主要页面

- `/mistake`：学生拍题入口
- `/generation-preview`：讲解生成预览
- `/select-profile`：学生档案选择
- `/history`：历史记录
- `/admin/settings`：全局语音设置

## 仓库说明

这个仓库现在对应 StudyMate / 作业通 产品线。面向用户的文案、页面标题与仓库说明应统一使用 StudyMate / 作业通 品牌。
