#!/usr/bin/env bash
# 作品视频拖动修复 —— 部署脚本（commit 961459a）
#
# 本次改动涉及两处「需要额外操作才生效」的东西：
#   1. docker-compose.yml 新增绑定挂载
#        ./frontend/data/camp-videos -> /app/data/camp-videos
#      —— 卷挂载变更必须 docker compose up -d 重建容器，restart 不够。
#   2. nginx/studymate.conf 新增 /api/camp/videos/ 直出 location
#      —— nginx 是宿主机 apt 安装的（不是容器），配置在
#         /etc/nginx/sites-enabled/studymate.conf，需 cp + reload。
#
# ⚠️ 关键风险（本脚本主要就是为了防它）：
#    命名卷 studymate-frontend-data 里已有老师后台上传的作品视频。
#    新增宿主机绑定挂载后，容器里 /app/data/camp-videos 会被
#    「空的宿主机目录」覆盖 → 已上传的视频会看起来「全部消失」。
#    所以必须先备份命名卷里的视频，再启动新容器，再把视频放回。
#
# 用法（在服务器上执行，需要 sudo）：
#   cd /home/ubuntu/studymate && bash scripts/deploy-camp-videos.sh

set -euo pipefail

PROJECT_DIR="/home/ubuntu/studymate"
NGINX_CONF="/etc/nginx/sites-enabled/studymate.conf"
HOST_VIDEO_DIR="$PROJECT_DIR/frontend/data/camp-videos"
VOLUME_NAME="studymate-frontend-data"

cd "$PROJECT_DIR"

echo "======== 1/7 拉取最新代码 ========"
git pull origin master

echo "======== 2/7 备份命名卷里已有的作品视频 ========"
sudo mkdir -p "$HOST_VIDEO_DIR"
BACKUP_DIR="$PROJECT_DIR/.camp-videos-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

if sudo docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  # 用临时容器把命名卷挂出来，把视频拷到备份目录。
  # 此时旧容器可能还在跑，只读拷贝是安全的。
  sudo docker run --rm \
    -v "$VOLUME_NAME:/from:ro" \
    -v "$BACKUP_DIR:/to" \
    alpine:latest \
    sh -c 'if [ -d /from/camp-videos ]; then cp -a /from/camp-videos/. /to/ ; fi'

  COUNT=$(sudo find "$BACKUP_DIR" -type f \( -name '*.mp4' -o -name '*.webm' -o -name '*.mov' -o -name '*.m4v' \) | wc -l)
  echo "  命名卷中找到 $COUNT 个视频，已备份到 $BACKUP_DIR"
else
  echo "  命名卷 $VOLUME_NAME 不存在，跳过（首次部署）"
  COUNT=0
fi

echo "======== 3/7 把视频放回宿主机目录（供 nginx 直出） ========"
if [ "$COUNT" -gt 0 ]; then
  sudo cp -a "$BACKUP_DIR"/. "$HOST_VIDEO_DIR"/
  # 让容器内 nextjs 用户也能读写（容器内 uid 通常为 1001）
  sudo chmod -R a+rX "$HOST_VIDEO_DIR"
  echo "  已放回 $(sudo find "$HOST_VIDEO_DIR" -type f | wc -l) 个文件"
else
  echo "  无视频需要迁移"
fi

echo "======== 4/7 重建 frontend 容器 ========"
# 卷挂载变更必须用 up -d（会重建容器）；docker compose restart 不会重新应用卷配置
sudo docker compose up -d --build frontend
sleep 5

echo "======== 5/7 更新 nginx 配置并重载 ========"
sudo cp "$PROJECT_DIR/nginx/studymate.conf" "$NGINX_CONF"
sudo nginx -t
sudo nginx -s reload

echo "======== 6/7 验证 ========"
sleep 2

echo "  --- 容器内 camp-videos ---"
sudo docker compose exec -T frontend sh -c 'ls /app/data/camp-videos 2>/dev/null | wc -l' || echo "  (读取失败)"

echo "  --- 宿主机 camp-videos ---"
sudo find "$HOST_VIDEO_DIR" -type f 2>/dev/null | wc -l

echo "  --- nginx 直出走本地回环测试 ---"
LOCAL_IP=$(hostname -I | awk '{print $1}')
SAMPLE=$(sudo find "$HOST_VIDEO_DIR" -type f -name '*.mp4' 2>/dev/null | head -1 | xargs -r basename)
if [ -n "$SAMPLE" ]; then
  echo "  抽样文件：$SAMPLE"
  echo -n "    完整请求   : "
  curl -s -o /dev/null -w "HTTP %{http_code}  %{content_type}\n" -H "Host: edu.xgteacher.cn" \
    "http://127.0.0.1/api/camp/videos/$SAMPLE"
  echo -n "    Range 请求 : "
  curl -s -D - -o /dev/null -H "Host: edu.xgteacher.cn" -H "Range: bytes=0-1023" \
    "http://127.0.0.1/api/camp/videos/$SAMPLE" | grep -iE "^HTTP|Content-Range" | tr '\n' ' '
  echo ""
else
  echo "  暂无视频文件，跳过抽样（上传一个后再验）"
fi

echo "======== 7/7 完成 ========"
echo ""
echo "  备份留在：$BACKUP_DIR"
echo "  确认页面上视频播放正常后，可删除：sudo rm -rf $BACKUP_DIR"
echo ""
echo "  请在浏览器里自检："
echo "    1. 打开任意作品详情页，视频能正常显示并播放"
echo "    2. 拖动进度条能任意跳转、秒响应（这是本次修复的目标）"
echo "    3. 若视频 404：确认宿主机 $HOST_VIDEO_DIR 下有对应的 <作品id>.mp4"
