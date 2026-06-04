# StudyMate Monorepo 部署设计

## 背景

当前有两个独立项目：
- **后端** (`ai-math-mistake-machine`): Node.js API 服务，端口 3000，提供 `/health`、`/api/session/analyze`
- **前端** (`AI-MATH-MISTAKE`): Next.js 应用，端口 3001，提供页面路由 `/mistake` 等及大量 API Routes

目标：合并为统一仓库，使用 Docker Compose + Nginx 部署到单台服务器。

## 架构决策

### 方案选择：混合模式（方案 A）

- 前端 Next.js 自带完整 API Routes（`/api/chat`、`/api/classroom`、`/api/mistake` 等），在前端容器内直接处理
- 仅 `/api/session/analyze` 需要调用后端服务，通过内部网络 `http://backend:3000` 通信
- Nginx 作为统一入口，按路径分发

### 部署拓扑

```
用户
  |
Nginx (80)
  |-- /machine/*  --> 后端容器 (backend:3000)
  |-- /*          --> 前端容器 (frontend:3001)
```

## 合并后仓库结构

```
StudyMate/
├── backend/                  # 原 ai-math-mistake-machine
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
├── frontend/                 # 原 AI-MATH-MISTAKE
│   ├── app/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── pnpm-workspace.yaml
│   └── ...
├── docker-compose.yml        # 统一编排
├── nginx/
│   └── studymate.conf        # Nginx 反代配置
└── deploy.sh                 # 一键部署脚本
```

## 服务定义

### 后端 (backend)

- **构建上下文**: `backend/`
- **端口**: 暴露 3000，绑定 `127.0.0.1:3000`
- **环境**: `NODE_ENV=production`, `PORT=3000`
- **重启策略**: `unless-stopped`

### 前端 (frontend)

- **构建上下文**: `frontend/`
- **端口**: 暴露 3001，绑定 `127.0.0.1:3001`
- **环境**: `NODE_ENV=production`, `PORT=3001`, `NEXT_TELEMETRY_DISABLED=1`
- **重启策略**: `unless-stopped`
- **内部通信**: 通过 Docker 网络 `http://backend:3000` 访问后端

## Nginx 配置

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

## 环境变量

前端需要在构建时或运行时知道后端地址。由于 Next.js standalone 模式支持运行时环境变量，建议在 `docker-compose.yml` 中注入：

```yaml
frontend:
  environment:
    - BACKEND_URL=http://backend:3000
```

前端代码中通过 `process.env.BACKEND_URL` 调用后端 `/api/session/analyze`。

## 部署流程

1. 服务器安装 Docker、Compose、Nginx
2. 克隆仓库到 `/opt/studymate/`
3. `docker compose up -d --build`
4. 复制 `nginx/studymate.conf` 到 `/etc/nginx/sites-enabled/`
5. `nginx -s reload`
6. 验收：`http://<IP>/` 和 `http://<IP>/machine/health`

## 后续 HTTPS

等域名就绪后：
1. 安装 Certbot：`apt install certbot python3-certbot-nginx`
2. 申请证书：`certbot --nginx -d yourdomain.com`
3. Nginx 配置自动更新，无需手动修改

## 验收标准

- [ ] `http://1.14.249.13/` 返回前端页面
- [ ] `http://1.14.249.13/machine/health` 返回后端健康状态
- [ ] 前端 `/mistake` 页面可正常访问
- [ ] 容器重启后自动恢复
