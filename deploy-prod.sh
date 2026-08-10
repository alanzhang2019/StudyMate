#!/usr/bin/env bash
# Production deploy script for ai-math-mistake-machine
#
# What this does:
#   1. Verifies we're at the repo root and on a clean tree
#   2. Pulls the latest master
#   3. Syncs frontend/.env.local from the env-var template (callers can
#      pre-create it; the script refuses to overwrite blindly)
#   4. Rebuilds the frontend image
#   5. Restarts the frontend container
#   6. Fixes ownership of the host-side bind mount for classroom
#      uploads (chown frontend/data/classrooms → 1001:1001 and verify
#      with an in-container touch test). Safe to re-run; runs the
#      script at frontend/scripts/fix-bind-mount-perms.sh.
#   7. Runs a health check against the new /api/integrations/health
#
# Usage:
#   ./deploy-prod.sh                      # pull master, rebuild, restart
#   ./deploy-prod.sh --no-pull            # rebuild with current tree
#   ./deploy-prod.sh --skip-healthcheck   # skip post-deploy ping
#
# Environment prerequisites (must be exported by caller):
#   REPO_DIR          absolute path to the repo on the server (default: pwd)
#   DEPLOY_DOMAIN     public domain the stack is served from (used for
#                     the post-deploy health check; e.g. https://app.example.com)
#   ENV_LOCAL_CONTENT  full contents of frontend/.env.local. If unset, the
#                      script will refuse to write env and exit 2.
#
# Exit codes:
#   0  deploy succeeded, health check passed
#   1  generic failure (see error output)
#   2  missing required env (REPO_DIR / DEPLOY_DOMAIN / ENV_LOCAL_CONTENT)
#   3  git working tree is dirty

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(pwd)}"
PULL=1
RUN_HEALTHCHECK=1

for arg in "$@"; do
  case "$arg" in
    --no-pull)            PULL=0 ;;
    --skip-healthcheck)   RUN_HEALTHCHECK=0 ;;
    -h|--help)
      sed -n '2,32p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

cd "$REPO_DIR"

echo "== 1/7 Sanity checks =="
git rev-parse --is-inside-work-tree >/dev/null
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "master" ]]; then
  echo "ERROR: expected to be on master, got '$current_branch'" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]] && [[ "$PULL" -eq 1 ]]; then
  echo "ERROR: working tree is dirty. Commit/stash before deploying." >&2
  git status --short >&2
  exit 3
fi

if [[ -z "${DEPLOY_DOMAIN:-}" ]]; then
  echo "ERROR: DEPLOY_DOMAIN must be set (e.g. https://app.example.com)" >&2
  exit 2
fi

echo "== 2/8 Chown host bind-mount for git =="
# The host-side bind mount `./frontend/data/classrooms` ends up
# owned by the container's `nextjs` user (UID 1001) after the
# container writes to it. `git pull` runs as the deploy user
# (typically `ubuntu`) and cannot unlink those files, so the
# pull aborts with "Permission denied" on every classroom JSON.
# Normalize ownership back to the deploy user here, before
# pulling. fix-bind-mount-perms.sh (Step 6/8) re-chowns to
# 1001:1001 once the container is back up, so classroom uploads
# still work.
HOST_DATA_DIR="$REPO_DIR/frontend/data"
if [[ -d "$HOST_DATA_DIR" ]]; then
  deploy_uid="$(id -u)"
  deploy_gid="$(id -g)"
  echo "  chown -R $deploy_uid:$deploy_gid $HOST_DATA_DIR"
  chown -R "$deploy_uid:$deploy_gid" "$HOST_DATA_DIR"
else
  echo "  (no $HOST_DATA_DIR yet, skipping)"
fi

echo "== 3/8 Pull latest master =="
if [[ "$PULL" -eq 1 ]]; then
  git pull --ff-only origin master
else
  echo "  (skipped, --no-pull)"
fi
echo "  HEAD: $(git rev-parse --short HEAD)"

echo "== 4/8 Sync frontend/.env.local =="
ENV_FILE="frontend/.env.local"
TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT

if [[ -z "${ENV_LOCAL_CONTENT:-}" ]]; then
  echo "ERROR: ENV_LOCAL_CONTENT must be set with the full .env.local contents" >&2
  echo "       (refusing to overwrite blindly). Paste your .env.local into" >&2
  echo "       the variable before invoking the script." >&2
  exit 2
fi

printf '%s' "$ENV_LOCAL_CONTENT" > "$TMP_ENV"

# Make sure the new integration env vars are present. If they're missing
# the script warns but does not block — you may have them under different
# names. This is a guardrail, not a hard requirement.
for var in RATE_LIMIT_INTEGRATION_CREATE_PER_MIN \
           RATE_LIMIT_INTEGRATION_POLL_PER_MIN \
           INTEGRATION_CORS_ORIGINS; do
  if ! grep -q "^${var}=" "$TMP_ENV"; then
    echo "  WARN: $var missing from ENV_LOCAL_CONTENT"
  fi
done

install -m 600 "$TMP_ENV" "$ENV_FILE"
echo "  wrote $ENV_FILE ($(wc -c < "$ENV_FILE") bytes, mode 600)"

echo "== 5/8 Rebuild frontend image =="
docker compose build --pull frontend

echo "== 6/8 Restart stack =="
docker compose up -d --no-deps --force-recreate frontend

echo "== 7/8 Fix bind-mount permissions =="
# The host-side bind mount that the frontend container writes
# classrooms into (`./frontend/data/classrooms`) is created by
# humans (root, ubuntu) whose uid does not match the container's
# `nextjs` user (uid 1001). After a fresh `git pull` the directory
# is often owned by the deploying user, so the first upload
# returns 500 EACCES and the admin UI shows "上传失败：import
# failed". Normalize ownership here, right after the container
# comes back up, and verify with a one-shot touch inside the
# container. See frontend/scripts/fix-bind-mount-perms.sh for
# the full implementation and SKIP_VERIFY / CHOWN_DRY_RUN knobs.
PERM_SCRIPT="$REPO_DIR/frontend/scripts/fix-bind-mount-perms.sh"
if [[ ! -f "$PERM_SCRIPT" ]]; then
  echo "  ERROR: $PERM_SCRIPT not found" >&2
  echo "         (was the new file committed and pushed?)" >&2
elif [[ ! -x "$PERM_SCRIPT" ]]; then
  # Fresh `git pull` from a Windows-side commit often lands without
  # the +x bit. Normalize here so the next deploy doesn't have to.
  echo "  → chmod +x $PERM_SCRIPT (was not executable)"
  chmod +x "$PERM_SCRIPT" || true
fi
if [[ -x "$PERM_SCRIPT" ]]; then
  "$PERM_SCRIPT" || {
    rc=$?
    echo "  WARN: fix-bind-mount-perms.sh exited $rc" >&2
    echo "        uploads may fail with EACCES until ownership is fixed" >&2
    echo "        run manually: sudo $PERM_SCRIPT" >&2
  }
else
  echo "  WARN: $PERM_SCRIPT is not executable even after chmod" >&2
  echo "        run: sudo chmod +x $PERM_SCRIPT && sudo $PERM_SCRIPT" >&2
fi

echo "== 8/8 Health check =="
if [[ "$RUN_HEALTHCHECK" -eq 1 ]]; then
  HEALTH_URL="${DEPLOY_DOMAIN%/}/api/integrations/health"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    body="$(curl -fsS --max-time 5 "$HEALTH_URL" || true)"
    if echo "$body" | grep -q '"status":"ok"'; then
      echo "  OK: $HEALTH_URL"
      echo "  $body"
      break
    fi
    if [[ "$i" -eq 10 ]]; then
      echo "  ERROR: $HEALTH_URL did not return status=ok after 20s" >&2
      echo "  last body: $body" >&2
      echo "--- recent container logs ---" >&2
      docker compose logs --tail=80 frontend >&2
      exit 1
    fi
    echo "  retry $i..."
  done
else
  echo "  (skipped, --skip-healthcheck)"
fi

echo ""
echo "Deploy complete."
echo "  HEAD: $(git rev-parse --short HEAD)"
echo "  Domain: $DEPLOY_DOMAIN"
