# 修复服务器部署状态 + 同步新课件

## Why

服务器上的 git 仓库处于损坏状态：master 分支是空分支（"No commits yet"），工作区被 `git clean -fd` 破坏（`frontend/data/` 目录已丢失），导致新课件 `cm_imp_cspj2024j_v1.json` 永远无法进入 named volume。**这是问题 1-5 一直未解决的根本原因**：之前所有 build 都是基于损坏的 git 状态，build 用的代码不完整。

## What Changes

- **本地修复 1：把新课件 commit 到 git**：用 `git add -f` 强制添加 `cm_imp_cspj2024j_v1.json`（`frontend/.gitignore` 第 69 行的 `/data` 规则默认忽略它），然后 commit + push 到 origin/master
- **服务器修复 1：恢复 master 分支**：`git fetch origin` + `git reset --hard origin/master`，把服务器 master 分支从空状态恢复到远程最新 commit `39e3ac2`
- **恢复丢失的工作区文件**：`git reset` 后自动从 origin/master checkout 所有 tracked 文件
- **重新 build 前端镜像**：因为工作区被 `git clean -fd` 破坏过
- **同步新课件到 named volume**：把 `cm_imp_cspj2024j_v1.json` 从 host 复制到 `/app/data/classrooms/`
- **验证 5 个原问题**

## Impact

- **Affected specs**: 部署运维、CSP 课件体系、排行榜
- **Affected code**:
  - `frontend/data/classrooms/cm_imp_cspj2024j_v1.json`（新课件，需同步到 volume）
  - `/app/data/classrooms/`（容器内 named volume 目录）
  - `/home/ubuntu/studymate/.git/`（服务器 git 仓库）
- **Affected deployments**:
  - 服务器上 `studymate-frontend` 容器（需 rebuild）
  - 服务器上 `master` 分支（需重置）
- **Risk level**: 🟡 中等
  - 远程仓库是好的（1831 个 objects），重置是安全的
  - named volume 里的 100+ 现有课件不会被 `git reset` 影响（它们在 volume 里，不在工作区）
  - 但 `git reset --hard` 会覆盖工作区里的所有 untracked 文件——已经 `git clean -fd` 过了，所以工作区已无重要 untracked

## ADDED Requirements

### Requirement: 服务器 git 仓库恢复到 origin/master

服务器 `master` 分支当前没有 commits（"No commits yet"）。系统 SHALL 把它重置到 `origin/master` 的最新 commit，让服务器和远程仓库保持一致。

#### Scenario: 服务器 git 状态恢复成功

- **WHEN** 用户在服务器执行 `git fetch origin && git reset --hard origin/master`
- **THEN** `git log --oneline -3` SHALL 显示最新的 commit 列表，HEAD 指向 `3baae36` 或更新
- **AND** `git branch -vv` SHALL 显示 `master -> origin/master`
- **AND** `ls frontend/data/classrooms/cm_imp_cspj2024j_v1.json` SHALL 成功（文件存在）

### Requirement: 重新 build 前端镜像

服务器工作区被 `git clean -fd` 破坏（`frontend/data/` 目录丢失）。系统 SHALL 重新 build 前端镜像，让新课件的源代码进入构建产物。

#### Scenario: docker compose build 成功

- **WHEN** 用户执行 `docker compose build --no-cache frontend`
- **THEN** build SHALL 完成，生成新镜像（sha256 哈希变化）
- **AND** build 过程中 `pnpm install` SHALL 成功（容器内 Node 20 环境，不是 host 的 Node 12）
- **AND** build 输出中 SHALL 包含 `better-sqlite3 prebuilt musl binary` 安装成功

### Requirement: 同步新课件到 named volume

新课件 `cm_imp_cspj2024j_v1.json` 在 git 仓库里，但不在容器 `/app/data/classrooms/`（named volume）。系统 SHALL 把它从 host 复制到容器，并修复文件 owner。

#### Scenario: 课件同步成功

- **WHEN** 用户执行 docker cp 循环 + chown
- **THEN** `docker exec studymate-frontend ls -la /app/data/classrooms/cm_imp_cspj2024j_v1.json` SHALL 显示文件存在
- **AND** 文件 owner SHALL 是 `nextjs:nodejs`（不是 root）
- **AND** 现有的 100+ 课件 SHALL 不受影响

### Requirement: 备份 named volume 数据

执行 reset 和 clean 操作前，系统 SHALL 先备份 named volume 里的所有数据（classrooms, mistake-sessions, SQLite DB）。

#### Scenario: 数据卷备份成功

- **WHEN** 用户执行 `docker exec studymate-frontend tar czf /tmp/data-backup.tar.gz -C /app data`
- **AND** `docker cp` 把备份复制到 host
- **THEN** host 上 SHALL 存在 `data-backup-*.tar.gz` 文件
- **AND** tar 包 SHALL 包含所有 100+ 课件 JSON、mistake-sessions 目录、studymate.sqlite

## MODIFIED Requirements

无（这是一个修复任务，不修改任何功能需求）

## REMOVED Requirements

无
