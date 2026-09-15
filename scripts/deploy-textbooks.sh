#!/usr/bin/env bash
# 深圳教材模块 —— 服务器侧部署脚本
#
# 前置（本地已完成，见 .workbuddy/upload_textbooks.sh）：
#   89 册 PDF 已按 slug 上传到 /home/ubuntu/studymate/frontend/data/textbooks/
#   （frontend/data 在 .gitignore 中，PDF 不入 git —— GitHub 100MB 单文件硬限制）
#
# 本脚本在服务器上执行：
#   cd /home/ubuntu/studymate && bash scripts/deploy-textbooks.sh
#
# 做四件事：拉代码 → 重建 frontend → 更新 nginx（/textbooks/ 直出）→ 逐项验证
set -euo pipefail

PROJECT_DIR="/home/ubuntu/studymate"
NGINX_CONF="/etc/nginx/sites-enabled/studymate.conf"
TB_DIR="$PROJECT_DIR/frontend/data/textbooks"

cd "$PROJECT_DIR"

echo "======== 1/4 拉取最新代码 ========"
git pull origin master

echo "======== 2/4 重建 frontend 容器 ========"
sudo docker compose up -d --build frontend
sleep 5

echo "======== 3/4 更新 nginx 配置并重载 ========"
sudo cp "$PROJECT_DIR/nginx/studymate.conf" "$NGINX_CONF"
sudo nginx -t
sudo nginx -s reload

echo "======== 4/4 验证 ========"
echo "  --- PDF 文件核对（应为 89 个，约 1.6GB） ---"
ls "$TB_DIR" | wc -l
du -sh "$TB_DIR"

echo "  --- 容器内数据目录只读挂载不影响教材（nginx 直接读宿主机路径） ---"
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "  --- nginx 直出抽样（本机回环） ---"
for s in chinese-bj-g1a math-bnu-g7a science-ed-g4a-lite physics-pep-g9; do
  echo -n "  $s : "
  curl -s -o /dev/null -w "HTTP %{http_code}  %{content_type}  %{size_download}B" \
    -H "Host: aijiangti.cn" "http://127.0.0.1/textbooks/$s.pdf" 2>/dev/null
  echo -n "   Range: "
  curl -s -D - -o /dev/null -H "Host: aijiangti.cn" -H "Range: bytes=0-1023" \
    "http://127.0.0.1/textbooks/$s.pdf" 2>/dev/null | grep -iE "^HTTP" | tr -d '\r'
done

echo "  --- 页面路由（应 200 走 Next.js） ---"
curl -s -o /dev/null -w "  /textbooks -> HTTP %{http_code}\n" -H "Host: aijiangti.cn" "http://127.0.0.1/textbooks"

echo ""
echo "  浏览器自检：打开 https://aijiangti.cn/textbooks"
echo "    1. 科目 tab / 年级 / 搜索正常筛选"
echo "    2. 点「在线阅读」弹层里能看到 PDF"
echo "    3. 点「下载」能保存文件"
