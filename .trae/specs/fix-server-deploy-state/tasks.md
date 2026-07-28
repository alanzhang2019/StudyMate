# Tasks

- [x] Task 0: 本地修复 — 把新课件 commit + push 到 origin/master
  - [x] SubTask 0.1: `git add -f frontend/data/classrooms/cm_imp_cspj2024j_v1.json`（绕过 /data gitignore 规则）
  - [x] SubTask 0.2: `git commit -m "feat(classroom): add 2024 CSP-J initial round exam (44 questions, 100 pts)"`
  - [x] SubTask 0.3: `git push origin master` → commit 39e3ac2 推送到 origin/master
  - [x] SubTask 0.4: `git cat-file -e origin/master:...` 验证 YES in origin/master

- [ ] Task 1: 备份 named volume 数据
  - [ ] SubTask 1.1: 在容器内打包 /app/data 目录
  - [ ] SubTask 1.2: 复制备份到 host 的 /home/ubuntu/backups/
  - [ ] SubTask 1.3: 验证备份文件存在且大小 > 0

- [ ] Task 2: 修复服务器 git 仓库
  - [ ] SubTask 2.1: `git fetch origin` 拉取远程所有 objects（已确认远程有 1831 个 objects）
  - [ ] SubTask 2.2: `git reset --hard origin/master` 把 master 恢复到远程最新 commit
  - [ ] SubTask 2.3: 验证 `git log --oneline -3` 显示 3baae36 是 HEAD
  - [ ] SubTask 2.4: 验证 `ls frontend/data/classrooms/cm_imp_cspj2024j_v1.json` 文件存在
  - [ ] SubTask 2.5: 验证 `ls frontend/data/classrooms/` 目录下有 100+ 个 .json 文件

- [ ] Task 3: 重新 build 前端镜像
  - [ ] SubTask 3.1: 在 host 上执行 `docker compose build --no-cache frontend`
  - [ ] SubTask 3.2: 监控 build 过程，确认 `pnpm install --frozen-lockfile` 成功
  - [ ] SubTask 3.3: 监控 build 过程，确认 `better-sqlite3 prebuilt` 安装成功
  - [ ] SubTask 3.4: 确认 build 完成且新镜像 sha256 变化

- [ ] Task 4: 重启容器
  - [ ] SubTask 4.1: `docker compose up -d frontend` 启动新容器
  - [ ] SubTask 4.2: `docker compose logs -f frontend` 确认 Next.js Ready

- [ ] Task 5: 同步新课件到 named volume
  - [ ] SubTask 5.1: 用 for 循环 + docker cp 把所有 .json 课件复制到容器
  - [ ] SubTask 5.2: `docker exec -u root studymate-frontend chown -R nextjs:nodejs /app/data`
  - [ ] SubTask 5.3: 验证 `cm_imp_cspj2024j_v1.json` 出现在 /app/data/classrooms/

- [ ] Task 6: 验证 5 个原问题
  - [ ] SubTask 6.1: 浏览器打开 `https://aijiangti.cn/csp-lecture?debug=1`，看终端 `[csp-lecture] sorted order` 日志
  - [ ] SubTask 6.2: 桌面端（≥1024px）打开 `/csp-lecture`，验证排行榜右侧 sticky
  - [ ] SubTask 6.3: 登录学生账号，完成一个 quiz，验证排行榜立即 +1
  - [ ] SubTask 6.4: A 课件 → 返回 → B 课件，验证 B 正常加载（无 404）
  - [ ] SubTask 6.5: 验证新课件 "2024年普及组CSP-J初赛真题卷" 出现在 /csp-lecture 列表

# Task Dependencies

- Task 2 (修复 git 仓库) 必须在 Task 3 (build) 之前
- Task 3 (build) 必须在 Task 4 (重启) 之前
- Task 1 (备份) 必须在 Task 2 (reset) 之前
- Task 4 (重启) 必须在 Task 5 (同步) 之前
- Task 5 (同步) 必须在 Task 6 (验证) 之前
