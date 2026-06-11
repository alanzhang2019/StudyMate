#!/bin/bash
# 在 oi 服务器上跑，定位 1Panel 网站配置文件
echo "=== 找 oi.aijiangti.cn 相关文件 ==="
find / -name "oi.aijiangti.cn*" 2>/dev/null
find / -name "*oi*jiangti*" 2>/dev/null

echo ""
echo "=== 1Panel 网站配置目录 ==="
ls -la /www/server/openresty/conf/ 2>/dev/null
echo "--- vhost ---"
ls -la /www/server/openresty/conf/vhost/ 2>/dev/null
echo "--- conf.d ---"
ls -la /www/server/openresty/conf/conf.d/ 2>/dev/null

echo ""
echo "=== 1Panel 网站配置 ==="
ls -la /www/server/openresty/conf/vhost/oi* 2>/dev/null
ls -la /www/server/panel/vhost/ 2>/dev/null
ls -la /www/server/panel/vhost/nginx/ 2>/dev/null

echo ""
echo "=== 找 1.14.249.13 在哪个配置里 ==="
grep -rln "1.14.249.13" /www/ /etc/ 2>/dev/null | head -5
