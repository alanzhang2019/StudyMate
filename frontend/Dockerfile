# ---- Stage 1: Base ----
FROM node:22-alpine AS base

# Use Aliyun mirrors for both apk (Alpine package manager) and pnpm/Node
# package downloads. The default registry endpoints are flaky from most
# Chinese cloud networks, which previously pushed `apk add` to ~27 minutes
# and `pnpm install` to several minutes — switching to mirrors drops both
# into the single-digit seconds range.
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# ---- Stage 2: Dependencies ----
FROM base AS deps

# Native build tools for sharp / @napi-rs/canvas AND for the
# better-sqlite3 fallback path (`node-gyp rebuild`) when
# prebuild-install cannot find a matching prebuilt musl binary.
# Keeping `build-base` means a missing prebuild only adds a few
# minutes of C++ compilation instead of failing the layer entirely.
RUN apk add --no-cache python3 cairo jpeg giflib librsvg pango build-base

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Layer order matters for build cache:
#   1. `pnpm install` from lockfile — cache hit when package.json/pnpm-lock.yaml unchanged.
#   2. Build workspace package `mathml2omml`.
#   3. Force-install better-sqlite3 without rebuilding from source — the
#      pnpm hoisted layout puts it at a deep path that `pnpm install`
#      does not always wire up prebuild-install for, and the previous
#      `npm run install --build-from-source` step took ~10 min per build.
#      Fetching the prebuilt musl binary from better-sqlite3's GitHub
#      release cuts this to a few seconds.
#
# Registry override: route pnpm and prebuild-install through npmmirror.com
# so we don't burn tens of minutes on cross-border tarball downloads.
ENV npm_config_registry=https://registry.npmmirror.com
ENV npm_config_prebuild_binary_host_mirror=https://npmmirror.com/mirrors
RUN set -eux; \
    pnpm install --frozen-lockfile; \
    cd packages/mathml2omml && npm run build; \
    cd /app; \
    echo "=== Install better-sqlite3 prebuilt musl binary ==="; \
    cd /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3; \
    npm_config_build_from_source=false \
    npm_config_prebuild_from_source=false \
    npm_config_target=$(node -p "process.versions.node") \
    npm_config_runtime=node \
    npm_config_target_arch=$(node -p "process.arch") \
    npm_config_target_platform=linuxmusl \
    npx --yes prebuild-install || \
      (echo "prebuild-install failed, falling back to source build"; \
       npm run install --build-from-source 2>&1 | tail -40); \
    echo "=== Locate generated .node files ==="; \
    (find /app -name 'better_sqlite3.node' 2>/dev/null || echo "find returned non-zero"); \
    echo "=== Verify build/Release ==="; \
    (ls -la build/Release/ 2>&1 || echo "build/Release not found")

# ---- Stage 3: Builder ----
FROM base AS builder

# Build-time defaults for server-side env reads inside API route handlers.
# These can be overridden via `docker compose build --build-arg` or
# `build.args` in docker-compose.yml.
ARG DEFAULT_MODEL=openai:gpt-4o-mini
ARG MISTAKE_OCR_MODEL=openai:gpt-4o-mini
ARG LLM_THINKING_DISABLED=false

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN NEXT_TELEMETRY_DISABLED=1 \
    DEFAULT_MODEL=${DEFAULT_MODEL} \
    MISTAKE_OCR_MODEL=${MISTAKE_OCR_MODEL} \
    LLM_THINKING_DISABLED=${LLM_THINKING_DISABLED} \
    pnpm build --webpack

# Ensure the prebuilt better-sqlite3 native binding is part of the standalone
# output. We copy the entire package (including the compiled .node file) into
# .next/standalone/node_modules so the runtime require() resolves it.
RUN set -eux; \
    mkdir -p /app/.next/standalone/node_modules/.pnpm; \
    cp -r /app/node_modules/.pnpm/better-sqlite3@11.10.0 /app/.next/standalone/node_modules/.pnpm/; \
    mkdir -p /app/.next/standalone/node_modules/better-sqlite3; \
    cp -r /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/. /app/.next/standalone/node_modules/better-sqlite3/; \
    echo "=== Standalone better-sqlite3 files ==="; \
    (find /app/.next/standalone/node_modules/better-sqlite3 -name '*.node' 2>/dev/null || true); \
    (ls -la /app/.next/standalone/node_modules/better-sqlite3/build/Release/ 2>&1 || echo "build/Release not found"); \
    test -f /app/.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node || (echo 'FATAL: .node missing in standalone' && exit 1)

# ---- Stage 4: Runner ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

# better-sqlite3 needs runtime libs (Alpine musl) for any dynamically loaded deps
RUN apk add --no-cache libc6-compat cairo pango jpeg giflib librsvg python3

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Pre-create the data directory and chown it to nextjs so storage modules
# that use process.cwd()/data (classroom-storage.ts, user-profile-storage.ts)
# can write to it at runtime. The image already has /app/data owned by
# nextjs, so no entrypoint fixup is needed when no volume is mounted here.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
