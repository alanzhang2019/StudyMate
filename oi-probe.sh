
#!/bin/bash
# oi 服务器探测脚本（只读，不修改任何东西）

echo "=== 1. 装了什么 web server ==="
which nginx apache2 caddy traefik 2>&1
systemctl list-units --type=service --all 2>/dev/null | grep -iE "nginx|apache|caddy|traefik" | head -10

echo ""
echo "=== 2. 80/443 端口谁在听 ==="
ss -tlnp 2>/dev/null | grep -E ":80 |:443 " | head -5

echo ""
echo "=== 3. oi.aijiangti.cn 配置文件在哪 ==="
find /etc /usr/local/etc -name "*.conf" 2>/dev/null | xargs grep -l "oi.aijiangti.cn" 2>/dev/null | head -5

echo ""
echo "=== 4. 完整 HTTP 响应头（看是否过 CDN） ==="
curl -I -k https://oi.aijiangti.cn/ 2>&1 | head -15

echo ""
echo "=== 5. nginx 版本 ==="
nginx -v 2>&1
