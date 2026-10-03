#!/usr/bin/env bash
# ============================================================================
# GitHub Actions 部署分发器（2026-10-03）
# ============================================================================
# 这把 key 在 ~/.ssh/authorized_keys 里带 command= 限制，只能触发本脚本：
#
#   command="/home/ubuntu/deploy/dispatch.sh",no-port-forwarding,no-agent-forwarding,no-pty,no-X11-forwarding ssh-ed25519 AAAA… github-actions-deploy-20261003
#
# 客户端（GitHub Actions）这样调用：
#   ssh -i <key> ubuntu@aijiangti.cn "deploy <app>"
# 因为设了 command=，客户端请求的原始命令会落到 $SSH_ORIGINAL_COMMAND。
#
# 设计取舍：
#   · 「机制」放在服务器上（本文件）—— 稳定、不可被仓库里的提交改掉，
#     所以即使某个仓库被写坏，攻击面也只是"能不能部署"，不是"能不能任意执行"。
#   · 「策略」放在各仓库的 deploy/deploy-<app>.sh —— 随代码版本化、可 review。
#   本脚本负责：校验 app 名 → 拉取 → 然后把控制权交给仓库里的脚本。
#
# 要改本文件：从仓库的 deploy/dispatch.sh 拷过来即可（两边应保持一致）。
# ============================================================================
set -euo pipefail

DEPLOY_ROOT=/home/ubuntu/deploy
LOG="$DEPLOY_ROOT/deploy.log"
mkdir -p "$DEPLOY_ROOT"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }

REQ="${SSH_ORIGINAL_COMMAND:-}"
log "===== 收到请求: ${REQ:-<空>} ====="

read -r CMD APP EXTRA <<<"$REQ" || true
if [ "${CMD:-}" != "deploy" ] || [ -z "${APP:-}" ] || [ -n "${EXTRA:-}" ]; then
    log "拒绝：只接受 'deploy <app>'（收到 '${REQ}'）"
    exit 64
fi

case "$APP" in
    studymate)   DIR=/home/ubuntu/studymate;   BRANCH=master ;;
    hl-platform) DIR=/home/ubuntu/hl-platform; BRANCH=main   ;;
    *)
        log "拒绝：未知应用 '$APP'（可用：studymate / hl-platform）"
        exit 64
        ;;
esac

cd "$DIR"

# 这两个仓库【只是部署目标】。任何服务器上的本地改动都会被下面的 reset --hard 丢掉，
# 所以先把它亮出来，别让它静默消失。
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "⚠️ $APP 仓库存在未提交的【已跟踪】改动，即将被 reset --hard 丢弃："
    git status --porcelain --untracked-files=no | tee -a "$LOG"
fi

log "拉取 origin/$BRANCH …"
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"
log "HEAD 现在 = $(git rev-parse --short HEAD)  $(git log -1 --format=%s)"

SCRIPT="$DIR/deploy/deploy-$APP.sh"
if [ ! -f "$SCRIPT" ]; then
    log "❌ 仓库里找不到 $SCRIPT —— 部署脚本必须随仓库走，中止"
    exit 66
fi

log "交给 $SCRIPT"
exec bash "$SCRIPT"
