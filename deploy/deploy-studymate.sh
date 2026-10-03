#!/usr/bin/env bash
# ============================================================================
# StudyMate 部署脚本（由 deploy/dispatch.sh 调用）
# 前提：dispatch.sh 已经完成 git fetch + git reset --hard origin/master
# ============================================================================
set -euo pipefail

APP_DIR=/home/ubuntu/studymate
BRANCH=master
PUBLIC=https://aijiangti.cn

cd "$APP_DIR"
echo "[studymate] 开始部署  HEAD=$(git rev-parse --short HEAD)  $(git log -1 --format=%s)"

# ---------------------------------------------------------------------------
# 1) 构建并重启 frontend 容器
#    注意只动 frontend：根 compose 里还定义了一个已废弃的 backend 服务，
#    不要用不带服务名的 up/down，否则会连它一起处理。
# ---------------------------------------------------------------------------
echo "[studymate] docker compose build frontend（Next.js 构建，通常几分钟）…"
docker compose build frontend

echo "[studymate] docker compose up -d frontend …"
docker compose up -d frontend

# ---------------------------------------------------------------------------
# 2) 同步 nginx 配置（仓库里的 nginx/studymate.conf 是权威副本）
#    改动前先备份；nginx -t 失败就自动回滚，且不 reload —— 线上继续用旧配置。
# ---------------------------------------------------------------------------
LIVE_NGINX=/etc/nginx/sites-enabled/studymate.conf
SRC_NGINX="$APP_DIR/nginx/studymate.conf"
NGINX_RC=0

if [ ! -f "$SRC_NGINX" ]; then
    echo "[studymate] ⚠️ 仓库里没有 $SRC_NGINX，跳过 nginx 同步"
else
    src_hash=$(sha256sum "$SRC_NGINX" | awk '{print $1}')
    live_hash=$(sudo -n sha256sum "$LIVE_NGINX" | awk '{print $1}')
    if [ "$src_hash" = "$live_hash" ]; then
        echo "[studymate] nginx 配置与仓库一致，无需同步"
    else
        TS=$(date +%Y%m%d-%H%M%S)
        BK="/home/ubuntu/hlplatform-backups/${TS}-nginx-sync/studymate.conf"
        mkdir -p "$(dirname "$BK")"
        sudo -n cp -p "$LIVE_NGINX" "$BK"
        echo "[studymate] nginx 配置有变化，已备份旧配置到 $BK"

        sudo -n cp -f "$SRC_NGINX" "$LIVE_NGINX"
        if sudo -n nginx -t >/dev/null 2>&1; then
            sudo -n systemctl reload nginx
            echo "[studymate] ✅ nginx 配置已更新并 reload"
        else
            echo "[studymate] ❌ 新 nginx 配置语法失败，回滚："
            sudo -n nginx -t 2>&1 | sed 's/^/    /' || true
            sudo -n cp -f "$BK" "$LIVE_NGINX"
            echo "[studymate] 已回滚；未 reload，线上仍在用旧配置"
            NGINX_RC=1
        fi
    fi
fi

# ---------------------------------------------------------------------------
# 3) 健康检查
# ---------------------------------------------------------------------------
echo "[studymate] 等待前端就绪…"
for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3001/ || echo 000)
    if [ "$code" = "200" ]; then echo "  第 $((i*2))s 就绪"; break; fi
    sleep 2
done

FAIL=0
chk() {
    local name="$1" url="$2" want="$3"
    local got
    got=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$url" || echo 000)
    if [ "$got" = "$want" ]; then
        printf '  ✅ %-34s %s\n' "$name" "$got"
    else
        printf '  ❌ %-34s %s（期望 %s）\n' "$name" "$got" "$want"
        FAIL=1
    fi
}

echo "[studymate] 健康检查："
chk "前端容器直连"        http://127.0.0.1:3001/                200
chk "站点首页（经 nginx）" "$PUBLIC/"                            200
chk "访问码状态接口"       "$PUBLIC/api/access-code/status"      200

# 跨应用回归：改动 StudyMate 不应影响另外三个应用
chk "hl-platform /ai"     "$PUBLIC/ai/api/health"               200
chk "错题本"              "$PUBLIC/wrong-notebook"              200
# /machine/ 已于 2026-10-03 退役，改为 301 跳到主应用
chk "已退役路由 /machine/" "$PUBLIC/machine/"                    301

[ "$NGINX_RC" = "0" ] || FAIL=1

if [ "$FAIL" = "0" ]; then
    echo "[studymate] ✅ 部署成功"
else
    echo "[studymate] ❌ 有检查未通过，见上"
fi
exit "$FAIL"
