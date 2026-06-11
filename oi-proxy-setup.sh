#!/bin/bash
# 一键给 oi.aijiangti.cn 加 /ai/ 反代 + 覆盖 CSP 头
# 使用方法：scp oi-proxy-setup.sh ubuntu@<oi-ip>:~ && ssh oi "sudo bash oi-proxy-setup.sh"

set -e

# 1. 找到 oi.aijiangti.cn 的 nginx 配置文件
OI_CONF=""
for path in /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf; do
    found=$(grep -rl "oi.aijiangti.cn" "$path" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        OI_CONF="$found"
        break
    fi
done

if [ -z "$OI_CONF" ]; then
    echo "FAIL: 没找到包含 oi.aijiangti.cn 的 nginx 配置"
    echo "--- 列出可能位置 ---"
    ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
    exit 1
fi

echo "FOUND: $OI_CONF"

# 2. 备份
BAK="${OI_CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$OI_CONF" "$BAK"
echo "BACKUP: $BAK"

# 3. 用 Python 解析 nginx 配置，在 oi server 块末尾 } 前插入 location
python3 - "$OI_CONF" << 'PYEOF'
import re, sys

conf = sys.argv[1]
text = open(conf, encoding="utf-8").read()

# 要插入的 location 块（4 空格缩进，对齐 nginx server 块内部）
LOCATION = """
    # AI JiangTi reverse proxy (auto-added by setup)
    location /ai/ {
        proxy_pass http://1.14.249.13:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header X-Frame-Options;
        add_header Content-Security-Policy "frame-ancestors 'self' https://oi.aijiangti.cn" always;
    }
"""

# 找所有 server { ... } 块（按大括号深度匹配）
blocks = []
i = 0
while True:
    m = re.search(r"server\s*\{", text[i:])
    if not m:
        break
    start = i + m.start()
    j = i + m.end() - 1
    depth = 0
    while j < len(text):
        ch = text[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                blocks.append((start, j + 1))
                i = j + 1
                break
        j += 1
    else:
        break

# 在包含 oi.aijiangti.cn 的 server 块末尾 } 前插入
injected = False
for s, e in blocks:
    block = text[s:e]
    if "oi.aijiangti.cn" in block:
        # 找到块最后一个 } 的位置
        last_brace_pos = e - 1
        # 倒回去去掉 } 前的空白
        head = text[:last_brace_pos].rstrip()
        if head.endswith("}"):
            head = head[:-1].rstrip()
            head = head + LOCATION + "}"
            text = head + text[last_brace_pos + 1 :]
            injected = True
            break
        else:
            print("FAIL: 块末尾不是 }")
            sys.exit(1)

if not injected:
    print("FAIL: 没有找到包含 oi.aijiangti.cn 的 server 块")
    sys.exit(1)

open(conf, "w", encoding="utf-8").write(text)
print("OK: location 已插入到 oi server 块")
PYEOF

# 4. 验证配置
echo "--- nginx -t ---"
nginx -t

# 5. 重载
echo "--- reload ---"
systemctl reload nginx

# 6. 验证
echo "--- 验证反代 ---"
curl -I -k https://oi.aijiangti.cn/ai/ 2>&1 | grep -iE "http/|content-security|x-frame" | head -5

echo ""
echo "DONE"
