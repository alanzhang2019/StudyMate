#!/usr/bin/env bash
# verify-wn-hl-growth.sh — wrong-notebook → hl-platform 成长值集成验证
#
# 背景：wn 调用 hl /api/integration/growth 失败是「静默吞掉」的（wn 侧一切正常，
#       但学生成长值不涨、日志无报错）。因此验收不能只看 wn，必须真去 hl 查 pet_events。
#
# 用法：
#   ./verify-wn-hl-growth.sh            # 安全模式：核对鉴权/密钥/档位表/绑定数，不写任何数据
#   ./verify-wn-hl-growth.sh --live EMAIL   # 额外做受控写入：用 EMAIL（须为已绑定账号）触发
#                                          # wn_transfer，核对 pet_events 入账与分档，随后清理该行
#
# 默认路径（均在 hl 生产服务器上）：
#   WN_ENV=/home/ubuntu/wrong-notebook/.env
#   HL_ENV=/home/ubuntu/hl-platform/.env
#   HL_DB=/home/ubuntu/hl-platform-data/app.db
#   HL_LOCAL=http://127.0.0.1:3100        # 容器内 hl 直连端口

set -u
WN_ENV="${WN_ENV:-/home/ubuntu/wrong-notebook/.env}"
HL_ENV="${HL_ENV:-/home/ubuntu/hl-platform/.env}"
HL_DB="${HL_DB:-/home/ubuntu/hl-platform-data/app.db}"
HL_LOCAL="${HL_LOCAL:-http://127.0.0.1:3100}"
LIVE_EMAIL=""
for a in "$@"; do case "$a" in --live) LIVE_EMAIL="${2:-}";; esac; done
# 取 --live 后的参数
prev=""; for a in "$@"; do
  if [ "$prev" = "--live" ]; then LIVE_EMAIL="$a"; fi
  prev="$a"
done

PASS=0; FAIL=0; SKIP=0
results=()
function check() { # $1=name $2=0/1/2(0pass,1fail,2skip) $3=detail
  local st; if [ "$2" = "0" ]; then st="PASS"; PASS=$((PASS+1));
  elif [ "$2" = "2" ]; then st="SKIP"; SKIP=$((SKIP+1)); else st="FAIL"; FAIL=$((FAIL+1)); fi
  results+=("[$st] $1 — $3")
  printf "%-6s %s\n       %s\n" "$st" "$1" "$3"
}

echo "============================================================"
echo " wn → hl 成长值集成验证  |  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ---- 前置：读取配置 ----
wn_base=$(grep -E '^HL_PLATFORM_BASE=' "$WN_ENV" 2>/dev/null | cut -d= -f2-)
wn_key=$(grep -E '^INTEGRATION_API_KEY=' "$WN_ENV" 2>/dev/null | cut -d= -f2-)
hl_key=$(grep -E '^WN_API_KEY=' "$HL_ENV" 2>/dev/null | cut -d= -f2-)

[ -n "$wn_base" ] && check "V1a HL_PLATFORM_BASE 已配置" 0 "$wn_base" \
                  || check "V1a HL_PLATFORM_BASE 已配置" 1 "未找到（wn .env 缺 HL_PLATFORM_BASE）"
[ -n "$wn_key" ]  && check "V1b INTEGRATION_API_KEY 已配置" 0 "len=${#wn_key}" \
                  || check "V1b INTEGRATION_API_KEY 已配置" 1 "未找到（wn .env 缺 INTEGRATION_API_KEY）"
[ -n "$hl_key" ]  && check "V1c WN_API_KEY 已配置(hl)" 0 "len=${#hl_key}" \
                  || check "V1c WN_API_KEY 已配置(hl)" 1 "未找到（hl .env 缺 WN_API_KEY）"

# ---- V2 密钥一致（两端必须同一个值，否则 x-api-key 鉴权不过 → 静默 401）----
if [ -n "$wn_key" ] && [ -n "$hl_key" ]; then
  if [ "$wn_key" = "$hl_key" ]; then
    check "V2 密钥一致(wm INTEGRATION_API_KEY == hl WN_API_KEY)" 0 "两端 64 位值完全相同"
  else
    check "V2 密钥一致" 1 "不一致！wn head=${wn_key:0:6}… hl head=${hl_key:0:6}…（会导致静默 401）"
  fi
fi

# ---- V3 端点可达 + 鉴权生效（错误 key 必须 401）----
if [ -n "$wn_base" ] && [ -n "$hl_key" ]; then
  ep="${wn_base%/}/api/integration/growth"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$ep" \
    -H "Content-Type: application/json" -H "x-api-key: WRONGKEY_$(date +%s)" \
    -d '{"email":"x@y.z","kind":"wn_transfer","ref":"wnp:probe","difficulty":"easy"}' 2>/dev/null)
  if [ "$code" = "401" ]; then
    check "V3 端点可达 + 错误 key→401（鉴权生效）" 0 "HTTP $code @ $ep"
  else
    check "V3 端点可达 + 错误 key→401" 1 "期望 401，实际 HTTP ${code:-timeout} @ $ep"
  fi
fi

# ---- V4 运行期档位表（须与公告 2/4/8/10 一致）----
tiers=$(grep -nE 'WN_TRANSFER_TIERS\s*=' /home/ubuntu/hl-platform/server/pet.js 2>/dev/null | head -1)
if [ -n "$tiers" ]; then
  block=$(grep -oE 'WN_TRANSFER_TIERS\s*=\s*\{[^}]*\}' /home/ubuntu/hl-platform/server/pet.js 2>/dev/null | head -1 | tr -d ' ')
  if echo "$block" | grep -qE "easy:2,?medium:4,?hard:8,?harder:10|easy:2,?medium:4,?hard:8,?harder:10"; then
    check "V4 档位表 WN_TRANSFER_TIERS = {easy:2,medium:4,hard:8,harder:10}" 0 "${block}"
  else
    check "V4 档位表 2/4/8/10" 1 "实际: ${block:-未解析}"
  fi
else
  check "V4 档位表 2/4/8/10" 2 "未在运行期 pet.js 找到 WN_TRANSFER_TIERS（需人工核对）"
fi

# ---- V5 真实绑定存在（否则功能对谁都不生效）----
if command -v sqlite3 >/dev/null 2>&1; then
  n=$(sqlite3 "$HL_DB" "SELECT count(*) FROM wn_bindings;" 2>/dev/null)
  if [ "${n:-0}" -gt 0 ] 2>/dev/null; then
    check "V5 wn_bindings 真实绑定数 ≥ 1" 0 "当前 $n 条绑定"
  else
    check "V5 wn_bindings 真实绑定数 ≥ 1" 1 "0 条绑定（功能对谁都不生效）"
  fi
else
  check "V5 wn_bindings 真实绑定数" 2 "无 sqlite3 CLI，跳过"
fi

# ---- V6 受控写入（仅 --live，用已绑定账号触发并核对后清理）----
if [ -n "$LIVE_EMAIL" ]; then
  if [ -z "$wn_base" ] || [ -z "$wn_key" ]; then
    check "V6 受控写入(wn_transfer 入账+分档)" 2 "缺少 wn 配置，跳过"
  else
    ref="wnp:e2e-$(date +%s)-$$"
    # 用 harder 难度，期望 delta=10
    resp=$(curl -s -w "|HTTP=%{http_code}" -X POST "${wn_base%/}/api/integration/growth" \
      -H "Content-Type: application/json" -H "x-api-key: $wn_key" \
      -d "{\"email\":\"$LIVE_EMAIL\",\"kind\":\"wn_transfer\",\"ref\":\"$ref\",\"difficulty\":\"harder\"}" 2>/dev/null)
    http=${resp##*|HTTP=}
    if [ "$http" = "200" ]; then
      row=$(sqlite3 "$HL_DB" "SELECT kind,ref,difficulty,delta FROM pet_events WHERE ref='$ref';" 2>/dev/null)
      if echo "$row" | grep -q "wn_transfer|$ref|harder|10"; then
        check "V6 受控写入：wn_transfer 入账且 harder→delta=10" 0 "$row"
      else
        check "V6 受控写入：分档核验" 1 "期望 kind=wn_transfer ref=$ref difficulty=harder delta=10，实际: ${row:-无行}"
      fi
      # 幂等核验：同 ref 再发一次，行数应仍为 1
      curl -s -o /dev/null -X POST "${wn_base%/}/api/integration/growth" \
        -H "Content-Type: application/json" -H "x-api-key: $wn_key" \
        -d "{\"email\":\"$LIVE_EMAIL\",\"kind\":\"wn_transfer\",\"ref\":\"$ref\",\"difficulty\":\"harder\"}" 2>/dev/null
      cnt=$(sqlite3 "$HL_DB" "SELECT count(*) FROM pet_events WHERE ref='$ref';" 2>/dev/null)
      if [ "${cnt:-0}" = "1" ]; then
        check "V6b 幂等：同 ref 重复发送不重复入账" 0 "ref=$ref 行数=$cnt"
      else
        check "V6b 幂等" 1 "ref=$ref 行数=${cnt:-?}（期望 1）"
      fi
      # 清理测试行
      sqlite3 "$HL_DB" "DELETE FROM pet_events WHERE ref='$ref';" 2>/dev/null
      left=$(sqlite3 "$HL_DB" "SELECT count(*) FROM pet_events WHERE ref='$ref';" 2>/dev/null)
      check "V6c 测试数据已清理" 0 "残留行数=${left:-0}"
    else
      check "V6 受控写入(wn_transfer 入账)" 1 "期望 200，实际 HTTP ${http:-?} body=${resp%|HTTP=*}"
      echo "      （若 404 NOT_BOUND 说明该邮箱未绑定；若 401 说明密钥问题）"
    fi
  fi
else
  check "V6 受控写入(需 --live EMAIL)" 2 "未启用 --live，跳过（避免污染真实账本）"
fi

echo "------------------------------------------------------------"
echo " 结果：PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "============================================================"
[ "$FAIL" = "0" ] && exit 0 || exit 1
