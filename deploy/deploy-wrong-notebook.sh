#!/usr/bin/env bash
#
# wrong-notebook 部署（被 dispatch.sh 调用）
#
# 源码真相在本仓库的 third-party/wrong-notebook/ —— 那是第三方开源项目
# wttwins/wrong-notebook 的部署副本（基线 tag v1.9.1 = fb79013e），
# 含本机部署适配（Dockerfile / docker-entrypoint.sh / docker-compose.yml /
# next.config.ts 的 basePath 等）。
#
# 部署目录 /home/ubuntu/wrong-notebook 只是「构建 + 运行」的地方：
# 源码由本脚本从 third-party 同步过去；运行数据（./data 错题库、./config、
# .env）留在那边、不参与同步。
#
# 为什么用 rsync 而不是在部署目录里 git pull：
#   third-party 是主仓库的一个子目录，单独 clone 子目录很别扭；
#   而 rsync --delete 能保证「仓库里没有的文件，部署目录里也不会残留」。
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/studymate}"
SRC="$REPO_DIR/third-party/wrong-notebook"
DST="${APP_DIR:-/home/ubuntu/wrong-notebook}"

log() { printf '[wrong-notebook] %s\n' "$*"; }

[ -d "$SRC" ] || { log "❌ 找不到源码目录 $SRC"; exit 66; }
[ -d "$DST" ] || { log "❌ 找不到部署目录 $DST"; exit 66; }

log "同步源码 $SRC → $DST"
log "  （排除 data/ config/ .env* .git/ deploy/ —— 运行数据与部署脚本不参与同步）"
rsync -a --delete \
  --exclude '/data/' \
  --exclude '/config/' \
  --exclude '/.env' \
  --exclude '/.env.*' \
  --exclude '/.git/' \
  --exclude '/deploy/' \
  "$SRC/" "$DST/"

cd "$DST"

log "docker compose build（Next.js 构建，通常 2-5 分钟）…"
docker compose build

log "docker compose up -d …"
docker compose up -d

# ⚠️ 应用配了 basePath=/wrong-notebook（见 next.config.ts），
#    所以直连容器也必须带这个前缀：直连 / 得 404（正常，不是故障）。
LOCAL_URL="http://127.0.0.1:3002/wrong-notebook"

log "等待容器就绪…"
ready=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$LOCAL_URL" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then ready=1; log "  第 ${i} 次探测就绪"; break; fi
  sleep 2
done
[ "$ready" = "1" ] || log "  ⚠️ 60s 内未就绪，继续做健康检查"

log "健康检查："
fail=0
chk() {  # chk <名称> <期望码> <url>
  local name="$1" want="$2" url="$3" got
  got=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$url" 2>/dev/null || echo 000)
  if [ "$got" = "$want" ]; then printf '  ✅ %-26s %s\n' "$name" "$got"
  else printf '  ❌ %-26s %s（期望 %s）\n' "$name" "$got" "$want"; fail=1; fi
}
chk "容器直连(带 basePath)" 200 "$LOCAL_URL"
chk "错题本（经 nginx）"    200 "https://aijiangti.cn/wrong-notebook"
chk "StudyMate 首页"        200 "https://aijiangti.cn/"
chk "hl-platform /ai"       200 "https://aijiangti.cn/ai/"
chk "已退役 /machine/"      301 "https://aijiangti.cn/machine/"

if [ "$fail" != "0" ]; then log "❌ 健康检查未全过"; exit 1; fi
log "✅ 部署成功"
