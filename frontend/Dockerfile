# ---- Stage 1: Base ----
# Pinned to 20.18.1-alpine (LTS). Using `node:22-alpine` (a moving tag)
# was previously pulling in whatever the latest 22.x happened to be, and
# `node:22.23.1-alpine` broke two things at once:
#   1. better-sqlite3@11.10.0 has no prebuilt for 22.23.1, so prebuild-install
#      falls back to source build, which then times out trying to fetch
#      Node headers from `unofficial-builds.nodejs.org`.
#   2. The corepack bundled with that image doesn't have the signing key
#      for pnpm@10.28.0, so `corepack prepare` fails with
#      "Cannot find matching keyid" before pnpm even gets installed.
# Pinning to 20.18.1-alpine (released 2024-10, LTS through 2026-04) gives
# us a known-good corepack + a Node ABI (NODE_MODULE_VERSION 115) that
# better-sqlite3@11.x has prebuilts for on npmmirror.
FROM node:20.18.1-alpine AS base

# Use Aliyun mirrors for both apk (Alpine package manager) and pnpm/Node
# package downloads. The default registry endpoints are flaky from most
# Chinese cloud networks, which previously pushed `apk add` to ~27 minutes
# and `pnpm install` to several minutes — switching to mirrors drops both
# into the single-digit seconds range.
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories
RUN apk add --no-cache libc6-compat
# Pin corepack to the latest version that still supports Node 20.
# corepack@0.35.0 (current `latest`) bumped its `engines.node` to
# `^22.22.2 || ^24.15.0 || >=26.0.0`, and on Node 20.18.1 it installs
# with an EBADENGINE warning then throws an "Internal Error" inside
# `corepack prepare` before pnpm even downloads. 0.34.0 is the last
# release with `engines.node` `^20.10.0 || ^22.11.0 || >=24.0.0`.
# Also route npm + corepack through npmmirror: corepack ignores
# `npm_config_registry` and reads `COREPACK_REGISTRY` instead.
ENV npm_config_registry=https://registry.npmmirror.com
ENV COREPACK_REGISTRY=https://registry.npmmirror.com
RUN npm install -g corepack@0.34.0 && \
    corepack enable && \
    corepack prepare pnpm@10.28.0 --activate

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
#
# better-sqlite3 also requires `bindings` and `prebuild-install` to locate
# the native .node file at runtime. These live inside the pnpm package's
# own node_modules folder (pnpm nests non-conflicting deps there), so we
# copy the whole pnpm package directory to keep the .pnpm symlink graph
# intact.
#
# `bindings@1.5.0` itself depends on `file-uri-to-path` which pnpm nests
# under bindings@1.5.0/node_modules/. We copy the whole pnpm bindings
# directory so its nested dependencies survive.
RUN set -eux; \
    mkdir -p /app/.next/standalone/node_modules/.pnpm; \
    cp -r /app/node_modules/.pnpm/better-sqlite3@11.10.0 /app/.next/standalone/node_modules/.pnpm/; \
    mkdir -p /app/.next/standalone/node_modules/better-sqlite3; \
    cp -r /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/. /app/.next/standalone/node_modules/better-sqlite3/; \
    cp -r /app/node_modules/.pnpm/bindings@1.5.0 /app/.next/standalone/node_modules/.pnpm/; \
    mkdir -p /app/.next/standalone/node_modules/bindings; \
    cp -r /app/node_modules/.pnpm/bindings@1.5.0/node_modules/bindings/. /app/.next/standalone/node_modules/bindings/; \
    mkdir -p /app/.next/standalone/node_modules/file-uri-to-path; \
    if [ -d /app/node_modules/.pnpm/bindings@1.5.0/node_modules/file-uri-to-path ]; then \
      cp -r /app/node_modules/.pnpm/bindings@1.5.0/node_modules/file-uri-to-path/. /app/.next/standalone/node_modules/file-uri-to-path/; \
    else \
      cp -r /app/node_modules/file-uri-to-path/. /app/.next/standalone/node_modules/file-uri-to-path/ 2>/dev/null || \
        cp -r /app/node_modules/.pnpm/file-uri-to-path@1.0.0/node_modules/file-uri-to-path/. /app/.next/standalone/node_modules/file-uri-to-path/ 2>/dev/null || true; \
    fi; \
    echo "=== Standalone better-sqlite3 files ==="; \
    (find /app/.next/standalone/node_modules/better-sqlite3 -name '*.node' 2>/dev/null || true); \
    (ls -la /app/.next/standalone/node_modules/better-sqlite3/build/Release/ 2>&1 || echo "build/Release not found"); \
    (ls -la /app/.next/standalone/node_modules/bindings 2>&1 || echo "bindings NOT in standalone"); \
    (ls -la /app/.next/standalone/node_modules/file-uri-to-path 2>&1 || echo "file-uri-to-path NOT in standalone"); \
    test -f /app/.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node || (echo 'FATAL: .node missing in standalone' && exit 1); \
    test -d /app/.next/standalone/node_modules/bindings || (echo 'FATAL: bindings missing in standalone' && exit 1); \
    test -d /app/.next/standalone/node_modules/file-uri-to-path || (echo 'FATAL: file-uri-to-path missing in standalone' && exit 1)

# Cache-bust marker: change `CACHE_BUST` whenever the copy block above
# changes so this stage and the runner below are rebuilt.
ARG CACHE_BUST=1
RUN echo "cache bust: ${CACHE_BUST} $(date +%s)"

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

# Copy the public/ directory in two passes:
#
#   1. COPY the whole public/ tree. This handles favicon/logos/etc. and
#      is what Next.js's standalone output expects to see.
#   2. THEN explicitly COPY the dbnet.onnx model file on top.
#
# Why two passes: BuildKit computes a content hash for the source
# directory and reuses the cached layer if the hash matches an older
# build. Even with `--no-cache` and `docker builder prune -a`, we hit
# a case where the cached public/ layer was from a build before
# models/ existed — so a single `COPY public ./public` was a 0.1s
# no-op that left /app/public/models/ empty in the runner.
# Forcing a separate explicit COPY of the model file invalidates
# just that sub-step and guarantees the file lands in the image.
COPY --from=builder /app/public ./public
COPY --from=builder /app/public/models ./public/models
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prompt templates are loaded at runtime from `lib/prompts/templates/`
# via `process.cwd()`. Next.js standalone tracing cannot follow
# `process.cwd()`-based file reads, so we copy the directory explicitly
# into the runner image. Without this, /api/generate/* routes return
# "Prompt template not found" (visible on /generation-preview).
COPY --from=builder --chown=nextjs:nodejs /app/lib/prompts ./lib/prompts

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
