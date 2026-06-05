# ---- Stage 1: Base ----
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# ---- Stage 2: Dependencies ----
FROM base AS deps

# Native build tools for sharp, @napi-rs/canvas
RUN apk add --no-cache python3 cairo jpeg giflib librsvg pango

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

RUN pnpm install --ignore-scripts && \
    cd packages/mathml2omml && npm run build

# ---- Stage 3: Builder ----
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN NEXT_TELEMETRY_DISABLED=1 pnpm exec next build

# ---- Stage 4: Runner ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

# better-sqlite3 native build deps
RUN apk add --no-cache libc6-compat cairo pango jpeg giflib librsvg python3 build-base

# Copy prebuilt better-sqlite3 native binding from deps
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/better-sqlite3/build ./node_modules/better-sqlite3/build

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
