#!/bin/bash
set -e

PROJECT_DIR="/opt/studymate"
NGINX_CONF="/etc/nginx/sites-available/studymate.conf"
REPO_URL="https://github.com/alanzhang2019/StudyMate.git"
REPO_BRANCH="master"

echo "=== StudyMate 一键部署脚本 ==="

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
HEALTH_NGINX=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/machine/health || echo "000")

echo "Backend (127.0.0.1:3000): HTTP $HEALTH_BACKEND"
echo "Frontend (127.0.0.1:3001): HTTP $HEALTH_FRONTEND"
echo "Nginx (/machine/health): HTTP $HEALTH_NGINX"

if [ "$HEALTH_BACKEND" == "200" ] && [ "$HEALTH_FRONTEND" == "200" ] && [ "$HEALTH_NGINX" == "200" ]; then
    echo "✅ 部署成功！"
else
    echo "⚠️ 部分服务健康检查未通过，请检查日志。"
    exit 1
fi
