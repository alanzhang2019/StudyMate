#!/usr/bin/env bash
# 上传深圳中考真题（doc/docx）到服务器（本地 → 生产）
# 真题由 frontend/app/api/exam-papers 路由提供下载，数据放在容器 bind 挂载的
# frontend/data/exam-papers，无需改 nginx。
# 用法（在 Git Bash 中）：bash .workbuddy/upload_exam_papers.sh
set -uo pipefail

SRC_DIR="D:/AItrade/ai-math-mistake-machine/frontend/data/exam-papers"
SERVER="ubuntu@aijiangti.cn"
REMOTE_DIR="/home/ubuntu/studymate/frontend/data/exam-papers"

echo "==== 中考真题上传开始 ===="
echo "本地源: $SRC_DIR"
echo "远端:   $SERVER:$REMOTE_DIR"

# 远端建目录
ssh -o BatchMode=yes "$SERVER" "mkdir -p '$REMOTE_DIR'" || {
  echo "[FAIL] 无法连接服务器或创建目录，请检查 ssh 配置"; exit 1;
}

for subj in chinese math english physics chemistry ethics history; do
  local_d="$SRC_DIR/$subj"
  [ -d "$local_d" ] || continue
  cnt=$(ls -1 "$local_d" 2>/dev/null | wc -l)
  echo "[SEND] $subj ($cnt 个文件)"
  scp -r -q -o BatchMode=yes "$local_d" "$SERVER:'$REMOTE_DIR/'"
done

echo "==== 上传结束 ===="
echo "随后需在服务器拉取代码并重新构建前端："
echo "  ssh $SERVER 'cd /home/ubuntu/studymate && git pull && cd frontend && npm run build'"
echo "（容器重启方式以项目 deploy 脚本为准）"
