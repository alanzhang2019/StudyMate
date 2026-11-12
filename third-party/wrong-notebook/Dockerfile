FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
#
# ★★★ 2026-11-12（构建失败实录）：`npm ci` 在 better-sqlite3 上直接失败 ——
#   `prebuild-install warn install Request timed out` 之后回退 node-gyp，
#   而 alpine 里没有 python（`gyp ERR! find Python ... executable path is ""`）。
#   根因不是代码，是**这台服务器访问 GitHub 超时**（实测 `curl https://github.com`
#   12 秒 000 超时；registry.npmjs.org 2 秒 200，registry.npmmirror.com 0.25 秒 200）。
#   better-sqlite3 的预编译包只发在 GitHub releases，于是必然卡死。
#   两条一起加：
#   ① `npm_config_better_sqlite3_binary_host` 指向 npmmirror 的二进制镜像
#      （实测 v12.4.6 的 `-node-v127-linuxmusl-x64.tar.gz` 在该目录下 302 命中）；
#   ② python3/make/g++ 作兜底 —— 万一镜像里没有对应 ABI/架构，就地编译，
#      仍然不需要 GitHub。两者都不成才会失败，比原来"只剩一条死路"稳。
ENV npm_config_better_sqlite3_binary_host=https://registry.npmmirror.com/-/binary/better-sqlite3
RUN sed -i 's#https://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories && apk add --no-cache libc6-compat python3 make g++ linux-headers

# ★★★ 2026-11-12 第二次修正（第一次只加 binary_host 还是卡死）：
#   实测 npm ci 挂 10 分钟无任何输出、**load average 0.06**（CPU 完全空闲）⇒
#   不是在编译，是在等一个**黑洞 TCP 连接**。npm 默认没有 fetch 超时，
#   遇上丢包的 CDN 会一直等下去。三条一起治：
#   ① registry 换 npmmirror（实测 0.25s）—— npm 默认 replace-registry-host=npmjs，
#      会把 lock 里 registry.npmjs.org 的 resolved 改写到当前 registry，不必改 lock；
#   ② `build_from_source`：不再调 prebuild-install（它只认 GitHub），
#      直接 node-gyp 就地编译 better-sqlite3；
#   ③ `nodedir=/usr/local`：node:22-alpine 自带 /usr/local/include/node，
#      否则 node-gyp 会去 nodejs.org 下 headers —— 那是第二个连不上的域名。
#   外加 fetch 超时/重试，避免再出现"无声挂死"。
ENV npm_config_registry=https://registry.npmmirror.com
ENV npm_config_build_from_source=true
ENV npm_config_nodedir=/usr/local
ENV npm_config_fetch_timeout=60000
ENV npm_config_fetch_retries=3
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install OpenSSL for Prisma
RUN sed -i 's#https://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories && apk add --no-cache openssl

# Generate Prisma Client and Seed Database
# We temporarily set DATABASE_URL to a local file for the build process to generate the file
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Pre-compile runtime scripts FIRST (needed for tag seeding)
RUN npx tsc scripts/rebuild-system-tags.ts --outDir dist-scripts --esModuleInterop --resolveJsonModule --skipLibCheck --module commonjs --target ES2020

# Initialize database: generate client, run migrations, seed admin user, seed system tags
RUN npx prisma generate \
    && npx prisma migrate deploy \
    && npx prisma db seed \
    && node ./dist-scripts/scripts/rebuild-system-tags.js

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies and create user
RUN sed -i 's#https://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories && apk add --no-cache su-exec openssl \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy Prisma CLI and engine files from builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations for runtime usage if needed (e.g. for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy config directory for runtime
COPY --from=builder --chown=nextjs:nodejs /app/config ./config

# Copy pre-compiled runtime scripts
COPY --from=builder --chown=nextjs:nodejs /app/dist-scripts ./dist-scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.js ./dist-scripts/scripts/seed-admin.js

# Create data directory for SQLite persistence
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy entrypoint script
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs https-server.js ./

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# Environment variables 
# Point to the persistent data location
ENV DATABASE_URL="file:/app/data/dev.db"
ENV AUTH_TRUST_HOST=true

# Use entrypoint script to handle DB initialization
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
