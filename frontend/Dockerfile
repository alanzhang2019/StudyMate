# ---- Stage 1: Base ----
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# ---- Stage 2: Dependencies ----
FROM base AS deps

# Native build tools for sharp, @napi-rs/canvas
RUN apk add --no-cache python3 cairo jpeg giflib librsvg pango build-base

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# 不带 --ignore-scripts：让 better-sqlite3 / sharp / @napi-rs/canvas 的 postinstall
# 自动跑 prebuild-install 下载 musl 预编译 .node；网络失败时回退 node-gyp 编译
RUN set -eux; \
    pnpm install; \
    cd packages/mathml2omml && npm run build; \
    cd /app; \
    # 强制 better-sqlite3 从源码编译（Alpine musl 经常没有匹配的预编译 .node）
    echo "=== Compiling better-sqlite3 from source ==="; \
    cd /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3; \
    npm run install --build-from-source 2>&1 | tail -40; \
    echo "=== Locate generated .node files ==="; \
    (find /app -name 'better_sqlite3.node' 2>/dev/null || echo "find returned non-zero"); \
    echo "=== Verify build/Release ==="; \
    (ls -la build/Release/ 2>&1 || echo "build/Release not found")

# ---- Stage 3: Builder ----
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN NEXT_TELEMETRY_DISABLED=1 pnpm exec next build

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

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
