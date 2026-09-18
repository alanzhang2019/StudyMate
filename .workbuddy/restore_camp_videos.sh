#!/usr/bin/env bash
# 少年AI创造营 作品介绍视频 系统性 404 诊断 + 恢复
# 已知（2026-09-18 实测）：封面 200、视频 404，二者读取路由同源(DATA_DIR=STUDYMATE_DB_DIR)。
# 视频文件被上传时写到了容器读不到的地方（多半是被命名卷覆盖掉的宿主机绑定目录）。
# 策略：从作品 API 拿登记的文件名 → 核对卷内是否存在 → 缺失的到宿主机全盘找并拷进卷（只拷不删）。
# 在服务器 ~/studymate 下执行。

cd /home/ubuntu/studymate || { echo "请先 cd ~/studymate"; exit 1; }

echo "====== 0. 卷内 camp-videos 现状 + DB_DIR ======"
docker compose exec frontend sh -c 'echo "DB_DIR=$STUDYMATE_DB_DIR"; echo "--- camp-videos ---"; ls -la "$STUDYMATE_DB_DIR/camp-videos/" 2>/dev/null || echo "(camp-videos 不存在/为空)"' || echo "!! exec 失败"

echo
echo "====== 1. 宿主机绑定目录 frontend/data/camp-videos 现状 ======"
ls -la frontend/data/camp-videos/ 2>/dev/null || echo "(宿主机目录不存在/为空)"

echo
echo "====== 2. 取作品 API 里登记了视频的文件名 ======"
# 优先本地 frontend 端口，失败再走公网
API_JSON=$(curl -s -m 15 "http://127.0.0.1:3001/api/camp/works?limit=100" 2>/dev/null)
[ -z "$API_JSON" ] && API_JSON=$(curl -s -m 15 "https://aijiangti.cn/api/camp/works?limit=100" 2>/dev/null)
echo "$API_JSON" | python3 -c '
import sys,json,re,os
try:
    data=json.load(sys.stdin)
except Exception as e:
    print("API 解析失败:",e); sys.exit(0)
items=data if isinstance(data,list) else data.get("data",data.get("items",[]))
names=[]
for it in items:
    f=it.get("introVideoFile") or ""
    if f:
        m=re.search(r"([^/]+\.(?:mp4|webm|mov|m4v))", f)
        if m: names.append(m.group(1))
print("\n".join(names) if names else "(无登记视频)")
open(os.path.expanduser("~/.video_names.txt"),"w").write("\n".join(names))
' 2>/dev/null || echo "(python3 不可用，跳过)"

echo
echo "====== 3. 逐个核对并恢复（宿主机全盘找 → 拷进卷）======"
docker run --rm \
  -v studymate-frontend-data:/data \
  -v "$HOME:/hosthome:ro" \
  alpine sh -c '
    apk add --no-cache findutils >/dev/null 2>&1 || true
    mkdir -p /data/camp-videos
    NAMES=""
    [ -f /hosthome/.video_names.txt ] && NAMES=$(cat /hosthome/.video_names.txt)
    echo "$NAMES" | while read -r name; do
      [ -z "$name" ] && continue
      if [ -e "/data/camp-videos/$name" ]; then
        echo "  已存在(跳过): $name"; continue
      fi
      # 在宿主机 ~/studymate 下找该文件
      hit=$(find /hosthome/studymate -name "$name" 2>/dev/null | head -1)
      if [ -n "$hit" ]; then
        cp -a "$hit" "/data/camp-videos/$name"
        echo "  拷入: $name  <-  $hit"
      else
        echo "  !! 未找到: $name（可能当时未真正落盘，需重新上传）"
      fi
    done
    echo "卷内现有:"; ls -1 /data/camp-videos 2>/dev/null
  ' || echo "!! docker run 失败（请 docker volume ls 核对卷名 studymate-frontend-data）"

echo
echo "====== 4. 验证（应返回 206 Partial Content）======"
for name in $(cat ~/.video_names.txt 2>/dev/null); do
  [ -z "$name" ] && continue
  echo "--- $name ---"
  curl -s -o /dev/null -w "HTTP %{http_code}  size_download=%{size_download}\n" \
    -H "Range: bytes=0-1023" "https://aijiangti.cn/api/camp/videos/$name"
done
rm -f ~/.video_names.txt

echo
echo "如仍有 404：视频文件确已丢失（当时未落盘或被误删），需在 /admin/camp/works 重新上传该作品视频。"
