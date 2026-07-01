#!/usr/bin/env bash
# Production deploy script for ai-math-mistake-machine
#
# What this does:
#   1. Verifies we're at the repo root and on a clean tree
#   2. Pulls the latest master
#   3. Syncs frontend/.env.local from the env-var template (callers can
#      pre-create it; the script refuses to overwrite blindly)
#   4. Rebuilds the frontend container and restarts the stack
#   5. Runs a health check against the new /api/integrations/health
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
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

cd "$REPO_DIR"

echo "== 1/6 Sanity checks =="
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

echo "== 2/6 Pull latest master =="
if [[ "$PULL" -eq 1 ]]; then
  git pull --ff-only origin master
else
  echo "  (skipped, --no-pull)"
fi
echo "  HEAD: $(git rev-parse --short HEAD)"

echo "== 3/6 Sync frontend/.env.local =="
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

echo "== 4/6 Rebuild frontend image =="
docker compose build --pull frontend

echo "== 5/6 Restart stack =="
docker compose up -d --no-deps --force-recreate frontend

echo "== 6/6 Health check =="
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
