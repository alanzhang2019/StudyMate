#!/usr/bin/env bash
# fix-bind-mount-perms.sh
#
# Fix ownership of the host-side bind mount that the frontend container
# writes classrooms into. The container's `nextjs` user runs as
# UID=1001 / GID=1001, but `git pull` / file copies from other users
# (root, ubuntu, etc.) can leave the host directory owned by someone
# else. The first upload then fails with EACCES (visible in
# /admin/csp-lecture as "上传失败：import failed").
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

HOST_CLASSROOMS_DIR="$REPO_DIR/frontend/data/classrooms"

echo "== fix-bind-mount-perms =="
echo "  repo dir:         $REPO_DIR"
echo "  host classrooms:  $HOST_CLASSROOMS_DIR"
echo "  target uid:gid:   $FRONTEND_UID:$FRONTEND_GID"
echo "  container:        $FRONTEND_CONTAINER"

# 1. Make sure the directory exists. If the operator has never
#    imported a classroom, the directory may not have been created
#    yet. mkdir -p is a no-op when it already exists.
if [[ ! -d "$HOST_CLASSROOMS_DIR" ]]; then
  echo "  → creating $HOST_CLASSROOMS_DIR (did not exist)"
  mkdir -p "$HOST_CLASSROOMS_DIR"
fi

# 2. chown the host-side bind mount. We use the numeric uid:gid
#    because the container's `nextjs` user does not exist on the
#    host, so a named chown would fail. -R covers any audio/ subdir
#    that imported classrooms may have created.
CHOWN_FLAGS=("-R")
if [[ "${CHOWN_DRY_RUN:-0}" == "1" ]]; then
  CHOWN_FLAGS+=("-n")
fi
chown "${CHOWN_FLAGS[@]}" "$FRONTEND_UID:$FRONTEND_GID" "$HOST_CLASSROOMS_DIR"
echo "  → chown $FRONTEND_UID:$FRONTEND_GID $HOST_CLASSROOMS_DIR"

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

echo "  → verifying write inside $FRONTEND_CONTAINER..."
if docker exec "$FRONTEND_CONTAINER" \
    sh -c 'cd /app/data/classrooms \
      && touch __perm_test__ \
      && rm __perm_test__ \
      && echo OK' >/tmp/fix-bind-mount-perms.out 2>&1; then
  cat /tmp/fix-bind-mount-perms.out
  rm -f /tmp/fix-bind-mount-perms.out
  echo "  ✅ write OK"
  exit 0
else
  cat /tmp/fix-bind-mount-perms.out >&2
  rm -f /tmp/fix-bind-mount-perms.out
  echo "  ❌ write FAILED — uploads will return 500 EACCES until this is fixed" >&2
  echo "     try: sudo chown -R $FRONTEND_UID:$FRONTEND_GID $HOST_CLASSROOMS_DIR" >&2
  exit 1
fi
