#!/bin/bash
set -e

# ⚠️ 已废弃（2026-10-03）—— 这是最早的「新服务器一键引导」脚本，与当前架构不符：
#   · PROJECT_DIR 写的是 /opt/studymate，线上实际是 /home/ubuntu/studymate
#   · 它健康检查 127.0.0.1:3000（旧 backend，已废弃且不再运行）
#   · 它健康检查 /machine/health —— 该路由 2026-10-03 已退役，改为 301 到 /api/health
#   · 它把配置写到 sites-available/，而线上是直接维护 sites-enabled/studymate.conf
#   · docker compose down 会停掉整个项目（含数据卷所在的 frontend）
#
# 日常部署请用 deploy/ 下的脚本（由 GitHub Actions 调用，见 .github/workflows/）：
#   deploy/deploy-studymate.sh    本仓库（StudyMate）
# 保留本文件只为记录最初的引导流程，请勿在生产机上执行。

PROJECT_DIR="/opt/studymate"
NGINX_CONF="/etc/nginx/sites-available/studymate.conf"
REPO_URL="https://github.com/alanzhang2019/StudyMate.git"
REPO_BRANCH="master"

echo "=== StudyMate 一键部署脚本（已废弃，见文件头说明）==="

# 1. 安装 Docker（如未安装）
if ! command -v docker &> /dev/null; then
    echo "[1/6] 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "[1/6] Docker 已安装，跳过"
fi

# 2. 安装 Nginx（如未安装）
if ! command -v nginx &> /dev/null; then
    echo "[2/6] 安装 Nginx..."
    apt-get update
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
else
    echo "[2/6] Nginx 已安装，跳过"
fi

# 3. 拉取代码
echo "[3/6] 拉取最新代码..."
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/$REPO_BRANCH"
else
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# 4. 构建并启动容器
echo "[4/6] 构建并启动容器..."
docker compose down || true
docker compose up -d --build

# 5. 配置 Nginx
echo "[5/6] 配置 Nginx..."
cp nginx/studymate.conf "$NGINX_CONF"

if [ ! -f /etc/nginx/sites-enabled/studymate.conf ]; then
    ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/studymate.conf
fi

# 测试并重载 Nginx
nginx -t
systemctl reload nginx

# 6. 健康检查
echo "[6/6] 执行健康检查..."
sleep 3

HEALTH_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health || echo "000")
HEALTH_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001 || echo "000")
# /machine/health 已于 2026-10-03 退役（301 -> /api/health），这里直接查新地址
HEALTH_NGINX=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/api/health || echo "000")

echo "Backend (127.0.0.1:3000): HTTP $HEALTH_BACKEND"
echo "Frontend (127.0.0.1:3001): HTTP $HEALTH_FRONTEND"
echo "Nginx (/api/health): HTTP $HEALTH_NGINX"

if [ "$HEALTH_BACKEND" == "200" ] && [ "$HEALTH_FRONTEND" == "200" ] && [ "$HEALTH_NGINX" == "200" ]; then
    echo "✅ 部署成功！"
else
    echo "⚠️ 部分服务健康检查未通过，请检查日志。"
    exit 1
fi
