#!/usr/bin/env bash
# fix-bind-mount-perms.sh
#
# Fix ownership of the host-side bind mounts that the frontend container
# writes into. The container's `nextjs` user runs as UID=1001 / GID=1001,
# but `git pull` / file copies / pre-deploy `chown -R ubuntu:ubuntu
# frontend/data` (deploy-prod.sh step 2) can leave the host directories
# owned by someone else. The first upload then fails with EACCES.
#
# Covered bind mounts (both live under frontend/data on the host):
#   - classrooms/   → teacher classroom imports (/admin/csp-lecture)
#   - camp-videos/  → student work intro videos (/admin/camp/works)
#     (2026-10-01: a pre-deploy blanket chown to `ubuntu` left
#      camp-videos unwritable → admin video upload EACCES. This script
#      previously only fixed classrooms; now covers both.)
#
# Usage (on the deploy host, typically via deploy-prod.sh):
#   ./frontend/scripts/fix-bind-mount-perms.sh
#
# Idempotent: safe to run on every deploy. The chown is cheap when
# ownership is already correct, and the touch test exits non-zero if
# the container still can't write — in which case the calling deploy
# script can decide whether to fail or just warn.
#
# Env overrides:
#   REPO_DIR         repo root (default: parent dir of this script)
#   FRONTEND_UID     container uid (default: 1001, matches Dockerfile)
#   FRONTEND_GID     container gid (default: 1001)
#   FRONTEND_CONTAINER  container name (default: studymate-frontend)
#   SKIP_VERIFY      if set, skip the in-container touch test
#   CHOWN_DRY_RUN    if set, do `chown -n` (no-op) instead of chowning

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
FRONTEND_UID="${FRONTEND_UID:-1001}"
FRONTEND_GID="${FRONTEND_GID:-1001}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-studymate-frontend}"

# Host-side bind mounts the frontend container writes to (relative to repo root)
BIND_MOUNT_DIRS=(
  "frontend/data/classrooms"
  "frontend/data/camp-videos"
)

echo "== fix-bind-mount-perms =="
echo "  repo dir:         $REPO_DIR"
echo "  target uid:gid:   $FRONTEND_UID:$FRONTEND_GID"
echo "  container:        $FRONTEND_CONTAINER"

# 1. Make sure the directories exist (mkdir -p is a no-op otherwise)
for rel in "${BIND_MOUNT_DIRS[@]}"; do
  dir="$REPO_DIR/$rel"
  if [[ ! -d "$dir" ]]; then
    echo "  → creating $dir (did not exist)"
    mkdir -p "$dir"
  fi
done

# 2. chown the host-side bind mounts. We use the numeric uid:gid
#    because the container's `nextjs` user does not exist on the
#    host, so a named chown would fail. -R covers any audio/ subdir
#    that imported classrooms may have created.
CHOWN_FLAGS=("-R")
if [[ "${CHOWN_DRY_RUN:-0}" == "1" ]]; then
  CHOWN_FLAGS+=("-n")
fi
for rel in "${BIND_MOUNT_DIRS[@]}"; do
  dir="$REPO_DIR/$rel"
  chown "${CHOWN_FLAGS[@]}" "$FRONTEND_UID:$FRONTEND_GID" "$dir"
  echo "  → chown $FRONTEND_UID:$FRONTEND_GID $dir"
done

# 3. Verify the container can actually write. We do this by spawning
#    a one-shot touch inside the running container. The container
#    must be up (deploy-prod.sh runs this after `docker compose up
#    -d --force-recreate frontend`).
if [[ -n "${SKIP_VERIFY:-}" ]]; then
  echo "  → SKIP_VERIFY set, skipping in-container write test"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "  WARN: docker not on PATH, skipping in-container write test" >&2
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$FRONTEND_CONTAINER"; then
  echo "  WARN: container '$FRONTEND_CONTAINER' is not running," \
       "skipping in-container write test" >&2
  exit 0
fi

RC=0
for container_path in /app/data/classrooms /app/data/camp-videos; do
  echo "  → verifying write inside $FRONTEND_CONTAINER:$container_path..."
  if docker exec "$FRONTEND_CONTAINER" \
      sh -c "cd $container_path \
        && touch __perm_test__ \
        && rm __perm_test__ \
        && echo OK" >/tmp/fix-bind-mount-perms.out 2>&1; then
    cat /tmp/fix-bind-mount-perms.out
    rm -f /tmp/fix-bind-mount-perms.out
    echo "  ✅ write OK: $container_path"
  else
    cat /tmp/fix-bind-mount-perms.out >&2
    rm -f /tmp/fix-bind-mount-perms.out
    echo "  ❌ write FAILED: $container_path — uploads will return 500 EACCES until this is fixed" >&2
    echo "     try: sudo chown -R $FRONTEND_UID:$FRONTEND_GID $REPO_DIR/frontend/data" >&2
    RC=1
  fi
done
exit $RC
