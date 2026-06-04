# StudyMate Monorepo 部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前后端项目合并为统一仓库，配置 Docker Compose + Nginx 部署，支持一键上线到服务器。

**Architecture:** 采用 Monorepo 结构，`backend/` 和 `frontend/` 分别独立构建，通过 `docker-compose.yml` 统一编排，Nginx 作为反向代理统一入口。

**Tech Stack:** Docker, Docker Compose, Nginx, Node.js 20/22, Next.js standalone, pnpm

---

## 文件结构映射

| 文件 | 职责 |
|------|------|
| `backend/` | 原 `ai-math-mistake-machine` 后端代码 |
| `frontend/` | 原 `AI-MATH-MISTAKE` 前端代码 |
| `docker-compose.yml` | 编排 backend + frontend 服务 |
| `nginx/studymate.conf` | Nginx 80 端口反代配置 |
| `deploy.sh` | 服务器端一键部署脚本 |

---

### Task 1: 创建 Monorepo 根目录结构

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx/studymate.conf`
- Create: `deploy.sh`
- Create: `.dockerignore` (根目录)

- [ ] **Step 1: 创建根目录 docker-compose.yml**

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: studymate-backend
    environment:
      - PORT=3000
      - NODE_ENV=production
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - studymate-net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: studymate-frontend
    environment:
      - NODE_ENV=production
      - PORT=3001
      - NEXT_TELEMETRY_DISABLED=1
      - BACKEND_URL=http://backend:3000
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    networks:
      - studymate-net
    depends_on:
      - backend

networks:
  studymate-net:
    driver: bridge
```

- [ ] **Step 2: 创建 Nginx 配置**

Create `nginx/studymate.conf`:

```nginx
server {
  listen 80 default_server;
  listen [::]:80 default_server;

  server_name _;

  client_max_body_size 25m;

  location /machine/ {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000/;
  }

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3001;
  }
}
```

- [ ] **Step 3: 创建服务器部署脚本**

Create `deploy.sh`:

```bash
#!/bin/bash
set -e

PROJECT_DIR="/opt/studymate"
NGINX_CONF="/etc/nginx/sites-enabled/studymate.conf"

echo "=== StudyMate Deployment ==="

# 1. Install dependencies
echo "[1/5] Installing Docker, Nginx..."
apt update -y
apt install -y ca-certificates curl git nginx

if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

docker version
docker compose version
nginx -v

# 2. Clone or pull repo
echo "[2/5] Pulling latest code..."
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

if [ -d "$PROJECT_DIR/.git" ]; then
  git pull
else
  git clone https://github.com/alanzhang2019/StudyMate.git .
fi

# 3. Build and start containers
echo "[3/5] Building and starting containers..."
cd "$PROJECT_DIR"
docker compose down
docker compose up -d --build

# 4. Configure Nginx
echo "[4/5] Configuring Nginx..."
cp "$PROJECT_DIR/nginx/studymate.conf" "$NGINX_CONF"

# Remove default site if exists
if [ -f /etc/nginx/sites-enabled/default ]; then
  rm /etc/nginx/sites-enabled/default
fi

nginx -t
nginx -s reload

# 5. Health check
echo "[5/5] Health check..."
sleep 5

echo "Backend health:"
curl -s http://127.0.0.1:3000/health || echo "BACKEND UNREACHABLE"

echo ""
echo "Frontend (via Nginx):"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ || echo "FRONTEND UNREACHABLE"

echo ""
echo "=== Deployment Complete ==="
echo "Frontend: http://<your-server-ip>/"
echo "Backend:  http://<your-server-ip>/machine/health"
```

```bash
chmod +x deploy.sh
```

- [ ] **Step 4: 创建根目录 .dockerignore**

Create `.dockerignore`:

```
node_modules
.next
dist
.git
*.log
.env.local
.env
.dbg
debug_*.md
```

- [ ] **Step 5: Commit 根目录配置**

```bash
git add docker-compose.yml nginx/studymate.conf deploy.sh .dockerignore
git commit -m "feat(deploy): add docker-compose, nginx and deploy script"
```

---

### Task 2: 迁移后端代码到 backend/ 目录

**Files:**
- Move: 所有原后端项目文件 → `backend/`
- Modify: `backend/Dockerfile`（确认路径正确）

- [ ] **Step 1: 移动后端代码**

假设当前在 `ai-math-mistake-machine` 仓库根目录，执行：

```bash
# 创建 backend 目录并移动文件
mkdir -p backend
git mv src backend/
git mv tests backend/
git mv Dockerfile backend/
git mv package.json backend/
git mv package-lock.json backend/
git mv tsconfig.json backend/
git mv .dockerignore backend/
git mv AGENTS.md backend/
git mv README.md backend/
git mv SKILL.md backend/
# 保留 docs/、deploy/ 等根目录文档，或按需移动
```

- [ ] **Step 2: 确认后端 Dockerfile 正确**

`backend/Dockerfile` 应保持原内容：

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm","run","start"]
```

- [ ] **Step 3: Commit 后端迁移**

```bash
git add backend/
git commit -m "refactor: move backend code to backend/ directory"
```

---

### Task 3: 迁移前端代码到 frontend/ 目录

**Files:**
- Move: 所有原 `AI-MATH-MISTAKE` 项目文件 → `frontend/`
- Modify: `frontend/next.config.ts`（如需调整）

- [ ] **Step 1: 复制前端代码到 frontend/**

从本机 `D:\AItrade\AI-MATH-MISTAKE` 复制到当前仓库的 `frontend/` 目录。

注意：前端有自己的 Git 历史，这里采用**直接复制文件**（不保留前端原 Git 历史），因为最终统一使用 StudyMate 仓库管理。

```bash
# 在 PowerShell 中执行（本机操作）
Copy-Item -Path "D:\AItrade\AI-MATH-MISTAKE\*" -Destination "frontend\" -Recurse -Force
```

- [ ] **Step 2: 确认前端 Dockerfile 正确**

`frontend/Dockerfile` 保持原内容：

```dockerfile
# ---- Stage 1: Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# ---- Stage 2: Dependencies ----
FROM base AS deps
RUN apk add --no-cache python3 build-base g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

# ---- Stage 3: Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm build

# ---- Stage 4: Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache libc6-compat cairo pango jpeg giflib librsvg
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: 调整前端端口为 3001**

前端容器需要暴露 3001 而非 3000，修改 `frontend/Dockerfile`：

```dockerfile
# 修改 ENV PORT=3000 为 ENV PORT=3001
ENV PORT=3001
# 修改 EXPOSE 3000 为 EXPOSE 3001
EXPOSE 3001
```

- [ ] **Step 4: Commit 前端迁移**

```bash
git add frontend/
git commit -m "feat: add frontend code to frontend/ directory"
```

---

### Task 4: 配置前端访问后端地址

**Files:**
- Modify: `frontend/` 中调用 `/api/session/analyze` 的代码

- [ ] **Step 1: 找到前端调用后端的代码位置**

Search for `session/analyze` or `api/session` in `frontend/`.

- [ ] **Step 2: 修改为通过 BACKEND_URL 环境变量访问**

将硬编码的 `http://localhost:3000/api/session/analyze` 改为：

```typescript
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
const response = await fetch(`${backendUrl}/api/session/analyze`, { ... });
```

- [ ] **Step 3: Commit 修改**

```bash
git add frontend/
git commit -m "feat: configure frontend to use BACKEND_URL env var"
```

---

### Task 5: 本地验证构建

**Files:**
- 无文件修改，仅执行命令

- [ ] **Step 1: 本地构建后端**

```bash
cd backend
npm ci
npm run build
```

Expected: `dist/server.js` 生成，无报错。

- [ ] **Step 2: 本地构建前端**

```bash
cd frontend
pnpm install
pnpm build
```

Expected: `.next/standalone` 生成，无报错。

- [ ] **Step 3: 本地 Docker Compose 测试**

```bash
docker compose up -d --build
```

Expected: 两个容器都启动成功。

- [ ] **Step 4: 验证服务可达**

```bash
curl http://127.0.0.1:3000/health
curl -I http://127.0.0.1:3001
```

---

### Task 6: 推送到远程仓库

- [ ] **Step 1: 推送到 GitHub**

```bash
git push origin master
```

---

### Task 7: 服务器部署

- [ ] **Step 1: SSH 登录服务器并执行 deploy.sh**

```bash
ssh -i /path/to/your_key root@1.14.249.13
```

在服务器上执行：

```bash
cd /opt/studymate
bash deploy.sh
```

- [ ] **Step 2: 验收**

浏览器访问：
- `http://1.14.249.13/` → 前端页面
- `http://1.14.249.13/machine/health` → 后端健康检查

---

## Self-Review

1. **Spec coverage**: 所有设计点（合并结构、Docker Compose、Nginx、部署脚本、环境变量）都已覆盖。
2. **Placeholder scan**: 无 TBD/TODO，所有代码块已提供。
3. **Type consistency**: `BACKEND_URL` 在 docker-compose.yml 和前端代码中一致。
