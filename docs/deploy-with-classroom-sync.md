# 部署 + 同步课件到 named volume

## 1. 服务器上执行（修正后的完整流程）

```bash
cd /home/ubuntu/studymate

# === 第 1 步：清掉冲突的 untracked（工具残留） ===
git status --porcelain | grep '^??' | awk '{print $2}' | xargs -rf rm -rf
# -r: 递归目录，-f: 强制；-rf 组合让命令对空输入不报错

# === 第 2 步：拉最新代码 ===
git pull origin master
git log --oneline -3    # 应该看到 3baae36 是 HEAD

# === 第 3 步：重新构建前端（容器内 Node 20 自动 pnpm install） ===
# ⚠️ 跳过 "cd frontend && pnpm install"，host Node 12 装不了 pnpm 10
docker compose build --no-cache frontend

# === 第 4 步：启动 ===
docker compose up -d frontend
docker compose logs -f frontend   # 看启动日志，按 Ctrl+C 退出

# === 第 5 步：⭐关键⭐ 同步 git 仓库里的所有课件到 named volume ===
# 这一步是之前 deploy-prod.sh 漏掉的，没有它新课件永远看不到！

# 5a. 先看一下 volume 里现在有哪些课件
docker exec -u root studymate-frontend ls -la /app/data/classrooms/ | head -20

# 5b. 把 git 里的所有 JSON 课件同步到容器（覆盖式）
#     只覆盖 .json 顶层文件（不递归子目录，因为子目录是音频）
for f in /home/ubuntu/studymate/frontend/data/classrooms/*.json; do
  docker cp "$f" "studymate-frontend:/app/data/classrooms/$(basename "$f")"
done
echo "✅ 同步完成"

# 5c. 修复文件 owner（容器内 nextjs 用户才能写）
docker exec -u root studymate-frontend chown -R nextjs:nodejs /app/data

# 5d. 验证新课件已就位
docker exec studymate-frontend ls -la /app/data/classrooms/cm_imp_cspj2024j_v1.json
```

## 2. 部署后验证

| # | 操作 | 期望 |
|---|---|---|
| 1 | 浏览器打开 `https://aijiangti.cn/csp-lecture` | 看到 "2024年普及组CSP-J初赛真题卷" 卡片 |
| 2 | 点击课件 | 进入 6 章节、44 题的试卷 |
| 3 | 桌面端 | 排行榜在右侧 sticky |
| 4 | `?debug=1` 访问 | 终端/eruda 看到 `[csp-lecture] sorted order` 日志 |

## 3. 关于"为什么之前 100+ 课件能看见"

服务器上 100+ 课件是**某个早期时刻手动复制进 volume 的**（可能是第一次部署时 `docker cp` 整个目录）。`deploy-prod.sh` **从来没自动同步**过 git → volume，所以后续所有 git 里新加的课件（包括 `cm_imp_cspj2024j_v1.json`）在生产环境都看不到。

**建议以后每次 `deploy-prod.sh` 后都执行步骤 5**，或者把步骤 5 集成到 `deploy-prod.sh`（加在 "5/6 Restart stack" 之后、"6/6 Health check" 之前）。
