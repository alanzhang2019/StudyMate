# Checklist

## 备份阶段
- [ ] Task 1.1 完成：容器内 /app/data 打包成功
- [ ] Task 1.2 完成：备份复制到 host /home/ubuntu/backups/
- [ ] Task 1.3 完成：备份文件存在且大小 > 1MB

## Git 仓库修复
- [ ] Task 2.1 完成：`git fetch origin` 拉取 1831 个 objects
- [ ] Task 2.2 完成：`git reset --hard origin/master` 成功
- [ ] Task 2.3 完成：`git log --oneline -3` 显示 3baae36 是 HEAD
- [ ] Task 2.4 完成：`frontend/data/classrooms/cm_imp_cspj2024j_v1.json` 存在
- [ ] Task 2.5 完成：`frontend/data/classrooms/` 目录下有 100+ 个 .json 文件

## Build 阶段
- [ ] Task 3.1 完成：`docker compose build --no-cache frontend` 完成
- [ ] Task 3.2 完成：`pnpm install --frozen-lockfile` 成功
- [ ] Task 3.3 完成：`better-sqlite3 prebuilt musl binary` 安装成功
- [ ] Task 3.4 完成：新镜像 sha256 哈希变化

## 重启阶段
- [ ] Task 4.1 完成：`docker compose up -d frontend` 启动新容器
- [ ] Task 4.2 完成：Next.js 显示 "Ready in XXXms"

## 课件同步
- [ ] Task 5.1 完成：所有 .json 课件复制到容器
- [ ] Task 5.2 完成：文件 owner 改为 nextjs:nodejs
- [ ] Task 5.3 完成：`/app/data/classrooms/cm_imp_cspj2024j_v1.json` 存在

## 5 个原问题验证
- [ ] 问题 1：`[csp-lecture] sorted order` 日志显示 1、2、3、4、5、6 正确顺序
- [ ] 问题 2：桌面端排行榜右侧 sticky 不动
- [ ] 问题 3-4：学生完成 quiz 后排行榜立即 +1（不需等 5 分钟）
- [ ] 问题 5：A → 返回 → B 课件能正常加载（无 404）
- [ ] 新课件："2024年普及组CSP-J初赛真题卷" 出现在 /csp-lecture 列表（44 题）
