#!/usr/bin/env bash
# fix-deploy.sh
# 一键修复服务器部署状态 + 同步新课件
# 在 /home/ubuntu/studymate 目录下执行

set -euo pipefail

echo "=========================================="
echo "  阶段 1/6：备份 named volume"
echo "=========================================="
mkdir -p /home/ubuntu/backups
TS=$(date +%Y%m%d-%H%M%S)
docker exec studymate-frontend tar czf /tmp/data-backup-${TS}.tar.gz -C /app data
docker cp studymate-frontend:/tmp/data-backup-${TS}.tar.gz /home/ubuntu/backups/
ls -la /home/ubuntu/backups/data-backup-${TS}.tar.gz
echo "✅ 备份完成: /home/ubuntu/backups/data-backup-${TS}.tar.gz"
echo ""

echo "=========================================="
echo "  阶段 2/6：修复服务器 git 仓库"
echo "  注意：master 才是主分支（最新），main 是旧分支（2026-06 截止，落后 155+ commits）"
echo "=========================================="
cd /home/ubuntu/studymate
echo "→ git fetch origin"
git fetch origin
echo "→ 远程最新 commit (origin/master):"
git log origin/master --oneline -3
echo ""
echo "→ git reset --hard origin/master（⚠️ 恢复 master 到远程，会丢弃工作区所有修改）"
git reset --hard origin/master
echo ""
echo "→ 验证修复结果:"
git log --oneline -3
git branch -vv
echo ""
echo "→ 验证 frontend/data/classrooms/ 已恢复（应有 100+ 文件）:"
ls -la frontend/data/classrooms/ | head -5
echo "总 .json 数: $(ls frontend/data/classrooms/*.json 2>/dev/null | wc -l)"
echo ""
echo "→ 验证新课件 cm_imp_cspj2024j_v1.json 已就位:"
ls -la frontend/data/classrooms/cm_imp_cspj2024j_v1.json
echo "✅ git 仓库已修复"
echo ""

echo "=========================================="
echo "  阶段 3/6：重新 build 前端镜像（容器内 Node 20 自动 pnpm install）"
echo "=========================================="
docker compose build --no-cache frontend
echo "✅ build 完成"
echo ""

echo "=========================================="
echo "  阶段 4/6：重启容器"
echo "=========================================="
docker compose up -d frontend
sleep 5
docker compose logs --tail=30 frontend
echo "✅ 容器已启动"
echo ""

echo "=========================================="
echo "  阶段 5/6：同步 git 仓库的课件到 named volume"
echo "=========================================="
SYNCED=0
for f in /home/ubuntu/studymate/frontend/data/classrooms/*.json; do
  docker cp "$f" "studymate-frontend:/app/data/classrooms/$(basename "$f")"
  SYNCED=$((SYNCED + 1))
done
echo "→ 已同步 $SYNCED 个课件到 volume"
echo ""
echo "→ 修复文件 owner:"
docker exec -u root studymate-frontend chown -R nextjs:nodejs /app/data
echo ""
echo "→ 验证新课件在容器内:"
docker exec studymate-frontend ls -la /app/data/classrooms/cm_imp_cspj2024j_v1.json
echo "→ 容器内课件总数: $(docker exec studymate-frontend ls /app/data/classrooms/*.json | wc -l)"
echo "✅ 课件同步完成"
echo ""

echo "=========================================="
echo "  全部完成！现在可以验证 5 个原问题"
echo "=========================================="
echo "请按 checklist.md 验证："
echo "  1. https://aijiangti.cn/csp-lecture?debug=1 — 看 [csp-lecture] sorted order 日志"
echo "  2. 桌面端 /csp-lecture — 排行榜右侧 sticky"
echo "  3-4. 学生完成 quiz → 刷新 → 排行榜立即 +1"
echo "  5. A → 返回 → B — B 正常加载"
echo "  6. 新课件 '2024年普及组CSP-J初赛真题卷' 出现在列表"
