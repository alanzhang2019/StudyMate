# StudyMate Monorepo 项目记忆

## 项目一句话
StudyMate（作业通，aijiangti.cn）— K12 AI 学习闭环的 monorepo。**三产品线共存**，不是单一"AI 数学错题机"。

## 三产品线

| 产品线 | 用户 | 入口 | 关键事实 |
|---|---|---|---|
| 小学 4-6 年级数学错题讲解 | 学生+家长 | `/mistake`、`/generation-preview` | MVP，backend 启发式诊断 + 前端 OpenMAIC 改造；端口 backend 3000 / frontend 3001 |
| CSP 真题训练 / 王牌战队2 | 信奥学生 | `/csp-lecture`、`/classroom/[id]` | 10 个学员按 A/B/C/D 梯队分组；第三方 Vjudge-AI-report C++ 接入已落地（subject='cpp', verdict ∈ AC/WA/TLE/RE/CE/MLE/PE） |
| 少年 AI 创造营 | 7-12 岁孩子 | `/camp`、`/camp/works`、`/camp/prepare`、`/camp/submit` | `edu.xgteacher.cn`，Alan张老师个人品牌，工具栈 **Trae IDE + WorkBuddy**；2026-08-30 上线三张业务表（camp_students/camp_class_logs/camp_works）；作品走 `works.xgteacher.cn`；历史成绩 **2000+ 学员作品 / 15 年项目教学经验** |

## 关键事实

- 部署域名：aijiangti.cn（数学错题）；edu.xgteacher.cn（创造营）；**创造营页面已移除 ICP/公安备案公示与 XIAOGAO LAB 主体字样**，品牌资产 `xgls-*` 已统一重命名为 `alan-*`（/assets/alan-avatar.png、alan-logo.svg、class .alan-brand）；远程微信图 URL 同步改为 `https://edu.xgteacher.cn/assets/alan-avatar.jpg`（需在服务器侧重命名该文件）
- Nginx 配置：`/machine/* → 3000`、`/* → 3001`，全路径超时 600s（为 LLM+TTS+图像长链路）
- 开发流程：所有非平凡改动走 Superpowers（brainstorming → writing-plans → TDD → review → verify）；specs 落 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`；plans 落 `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
- 复用上游：OpenMAIC（AGPL-3.0），复用 shell/provider/workflow/deployment，**不**复用课堂生成的教学流式假设
- North-star：同类题纠错率
- 启发式规则 vs LLM：偏好 `规则 + 结构化抽取 + LLM` 混合链路
- CSP 真题卷走 QuizView 状态机：`not_started → answering → submitting → finalized`，含跨 6 scene 总分 + 重置
- 第三方接入：`POST /api/integrations/mistake` + `GET /api/integrations/jobs/{id}`，IP 限流（创建 10/min、轮询 120/min、重试 10/min）
- 少年 AI 创造营「学生自助提交 → 老师审核」闭环：学生在 `/camp/submit` 填表 → `POST /api/camp/works`（公开、无需登录、入库即 `status=pending`，单 IP 10 分钟 8 次限流 + 蜜罐防垃圾）→ 老师 `/admin/camp/works` 点「通过」→ 公开墙 `/camp/works` 展示。`camp_works.studentId` 已为可空（学生无学员档案时存 `studentName`）。
- 少年 AI 创造营「上传 HTML 作品 → 自动介绍/封面 → 匿名二次编辑」：`camp_works` 含 `htmlFile/editToken/coverSource` 三列；HTML 落盘 `DB_DIR/camp-uploads/`、封面落盘 `DB_DIR/camp-covers/`；自动介绍走 `callLLM`、自动封面走 `generateImage(seedream)`（`lib/server/camp-work-autogen.ts`）；学生凭 `editToken` 访问 `/camp/works/edit/<token>` 编辑页二次修改。
- **服务器部署路径 `/home/ubuntu/studymate`**，实际生效命令：`cd /home/ubuntu/studymate && git pull origin master && docker compose up -d --build frontend`（只动 frontend 时够用；传课件需补 `sudo frontend/scripts/fix-bind-mount-perms.sh`）。
- **深圳教材模块**（2026-09-15 上线）：入口 `/textbooks`（首页 nav「📖 深圳教材」），89 册 1.7GB PDF 落服务器 `frontend/data/textbooks/`（gitignore + dockerignore，**git pull / docker build 不动它**），nginx `/textbooks/` 直出（`$request_uri` 白名单 `[a-z0-9-]+\.pdf$` + 1y immutable + COOP/COEP）。元数据 `frontend/lib/textbooks.ts`（10 科、深圳在用版本标注：数学北师大/英语沪教牛津/科学教科/地理湘教）。**文件名必须全 ASCII slug**（`chinese-bj-g1a.pdf` 式），中文原名不能进白名单。元数据/上传脚本在 `.workbuddy/gen_textbooks_meta.py` + `upload_textbooks.sh` + `textbook-upload-map.tsv`；部署脚本 `scripts/deploy-textbooks.sh`。页面带版权声明（原出版机构所有）与官方平台 basic.smartedu.cn 指引。

## 易漏点（踩过的坑）

- backend/startup/runStartup.ts 默认 `FE_ROOT=D:\AItrade\AI-MATH-MISTAKE`，但当前仓库是 `D:\AItrade\ai-math-mistake-machine\frontend`，需要 `FE_ROOT` 环境变量覆盖
- 部署时必须把 `frontend/data/classrooms/*.json` 同步进 named volume 并 `chown nextjs:nodejs`，否则新课件看不见
- `backend/app/` 目录名是 Next.js App Router 风格但不一定被 Next.js 编译，是给前端 monorepo 共享用的占位组件
- "少年 AI 创造营"完全独立于"涌现智训 / Emergix"（涌现智训是 B 端企业培训，是另一个人设；少年 AI 创造营是 C 端 7-12 岁启蒙）
- **Next.js 15+ 动态路由 `params` 是 Promise**：App Router 的 `page.tsx` 和 `route.ts` handler 都必须 `await params`，否则 `[id]` 路由取到的 `id` 是 undefined，导致 findUnique 404。本项目已因此在 `admin/camp/works/[id]` 审核时报"作品不存在"。
- 少年 AI 创造营对外品牌统一为 **Alan张老师**（C 端 7-12 岁启蒙），代码里资产/类名已统一为 `alan-` 前缀；**勿再新增 `xgls-` 引用**，也勿在页面恢复 XIAOGAO LAB / 苏ICP备 / 苏公网安备 字样（用户已要求移除）。
- **同一条消息里对同一文件发多个 Edit 会静默丢失部分改动**（返回"Successfully edited"但没落盘），已踩 2 次（handleShare、HTML 上传功能）。**同文件多改动用 Read 完整 + Write 重写，或逐个 Edit 分开发消息；提交前 grep/git diff 逐点核对。**
- 自动封面依赖 `resolveImageApiKey('seedream')`（读 server-providers.yml 或 env）；生产 docker-compose 只显式配了 KIMI_API_KEY，**未配 seedream 图生 key** → 自动封面会静默跳过（coverSource='none'，学生可手动上传）。需在服务器确认 SEEDREAM key 是否已配。

## 视频自动播放 + 拖动（课题页 `/camp/conundrums`）

**浏览器 autoplay policy 默认禁止「带声 + 无用户手势」的播放** —— 只写 `autoPlay` 属性会被**静默拒绝**（表现就是"点开后停在 0:00"）。

正确做法（已在 `app/camp/conundrums/page.tsx` 落地）：
1. `useEffect` + `ref` 主动触发播放
2. **三级兜底**：先试有声 → 被拒则 `muted=true` 重试 → 仍失败保留原生 `controls`
3. 静音降级后**必须**给出「点这里开声音」按钮（`.conundrum-player-unmute`），否则用户以为视频坏了
4. `video` 加 `key={id}`，切换条目时重建元素，避免复用旧 src 与播放状态

**支持拖动播放（用户要求"提前缓存"）**：
- `preload="auto"`（挂载即完整缓存该集）—— 单集 2-9MB、均 4.5MB，可接受
- 展开课题时插 `<link rel="prefetch" as="video">` 低优先级预取；**刻意不写 cleanup**（移除标签会让浏览器取消进行中的预取）
- **服务端本来就支持 Range**，卡顿不是协议问题而是没预加载 —— 先查服务端再改代码

**视频文件本身的准入判据**（27 个课题视频已全部满足）：
- 编码必须 `h264(avc1) + aac`（HEVC/`hvc1` 在 Chrome 播不了）—— 用 `ffprobe -show_entries stream=codec_name,codec_tag_string` 核
- `moov` box 要紧跟 `ftyp` 位于**文件头**（否则首次播放要下完整个文件）

## Nginx 配置约定（`nginx/studymate.conf`）

**⚠️ nginx 不在 docker-compose 里**（该文件只有 backend / frontend）——
它是宿主机 apt 安装的，配置在 `/etc/nginx/sites-enabled/studymate.conf`。
改配置的生效方式：`sudo cp nginx/studymate.conf /etc/nginx/sites-enabled/` + `sudo nginx -t && sudo nginx -s reload`。
**不是** `docker compose exec nginx ...`（会报服务不存在）。

**⚠️ 头号坑（2026-09-15 实锤）：conflicting server name 会静默吞掉整个配置文件。**
`sites-enabled/default`（certbot 生成）与 `studymate.conf` 曾同时声明 `aijiangti.cn:80`，
nginx 按字母序加载 → default 先到 → **studymate.conf 的 server 块被整体忽略**，
`nginx -t` 只给 warning。**后果：/videos/ 与 /api/camp/videos/ 直出配置写了很久却从未生效，全部走了 Next.js 代理。**
已修复：移除 default 符号链接（备份 `default.bak-20260915`）+ studymate.conf 重写为 80（仅 301 跳 https）/443（全部业务）完整布局。
**新增 location「不生效」且行为像走了 upstream 时，先查是否有第二个文件声明了相同 `server_name:port`；reload 后确认无 conflicting server name 警告。**

**`/videos/` location 直出**（课题视频，绕过 Next.js）：
- 原因：**Next.js 对 `public/` 静态资源默认返回 `Cache-Control: max-age=0`**，每次播放都回源；叠加 `proxy_buffering off`，拖动反复触发缓冲
- 改后：nginx `alias` 直接读宿主机 `frontend/public/videos/`（conflicting server name 修复后已真正生效）

**`/api/camp/videos/` location 直出**（作品介绍视频，见下节）

**五个必须记住的坑**：
1. **子 location 的 `add_header` 会覆盖父级** → COOP/COEP 必须重复声明
2. **不要写 `expires` 指令** → 它会与 `add_header Cache-Control` 同名头互相覆盖，生效哪条取决于书写顺序
3. **不要手工 `add_header Accept-Ranges bytes`** → nginx 静态模块自带，会重复出两个
4. `try_files $uri =404` → 文件不存在必须 404，**不能回落成 HTML**（否则播放器解析失败）
5. **`alias` 在正则 location 与前缀 location 下行为不同**（详见下节，必须实测）

**改配置后必须校验语法 + 实测行为**（配错会让整站 502）：
```bash
docker run --rm -v "//d/AItrade/ai-math-mistake-machine/nginx/studymate.conf:/etc/nginx/conf.d/studymate.conf:ro" nginx:alpine nginx -t
```

### ⚠️ nginx `alias` 在正则 location 下的陷阱（实测得出）

```nginx
# ❌ 正则 location + alias → 合法请求也 404
#    原因：regex location 下 alias 是「整个匹配 URI 被替换成 alias 路径」，文件名会丢
location ~ ^/api/xxx/[a-zA-Z0-9-]+\.mp4$ { alias /data/; }
# 试过 alias /data/$1;  → 仍 404

# ❌ 嵌套正则 location 更糟：合法文件 404，而穿越反而 200
location /api/xxx/ {
    location ~ ^...$ { alias /data/; try_files $uri =404; }
    try_files /__deny__ =404;
}

# ✅ 前缀 location + if 白名单（正确做法）
location /api/camp/videos/ {
    alias /home/ubuntu/studymate/frontend/data/camp-videos/;
    if ($request_uri !~ "^/api/camp/videos/[a-zA-Z0-9-]+\.(mp4|webm|mov|m4v)$") {
        return 404;
    }
    try_files $uri =404;
}
```

- **前缀 location 下的 alias 保留后续路径段**，路径拼接才正确
- 白名单用 **`$request_uri`（未解码原始值）** 而非 `$uri`，可挡 `%2e%2e%2f` 编码穿越
- **`nginx -t` 通过 ≠ 行为正确** —— 这类配置必须起容器逐条 curl 实测

## 视频服务三处约定（课题视频 / 作品视频 / 封面）

| 资源 | 位置 | 服务方式 | Range | 缓存 |
|---|---|---|---|---|
| 课题视频 | `frontend/public/videos/conundrums/`（宿主机） | nginx `location /videos/` 直出 | ✅ | 30d immutable |
| 作品介绍视频 | `frontend/data/camp-videos/`（**绑定挂载**，原为命名卷） | nginx `location /api/camp/videos/` 直出 | ✅ | 365d immutable |
| 封面图 | `frontend/data/camp-covers/` | Next.js API 路由 `readFileSync` | 不需要 | 365d immutable |

**重要**：
- **封面图几百 KB 用 `readFileSync` 没问题；视频几十上百 MB 绝不能照抄** ——
  必须 `createReadStream` 流式 + 支持 Range，否则（a）拖动不了（b）多人同看会吃满 Node 内存。
  **本项目已踩此坑**（`camp/videos` 路由照抄了 `camp/covers`）。
- **复制粘贴相邻功能的实现时，先问「这个做法的前提在我的场景成立吗」。**
- `camp-videos` 通过 `docker-compose.yml` 绑定挂载到宿主机 →
  **改卷挂载必须 `docker compose up -d`（重建），`restart` 不够**；
  且新挂载会覆盖命名卷原有内容 → **部署前必须先备份命名卷**（用 `scripts/deploy-camp-videos.sh`）。

## 本地验证链路（构建跑不起来时的替代方案）

**本机 `next dev` / `next build` 跑不完整**（沙箱 `safe-delete` 守卫按文件行数判定，>50 行即拦；Turbopack 另有 `RegExp.exec` 栈溢出）。
→ 用这条链路做真机验证：
```bash
# 起真实 nginx 容器（比 python http.server 强：能验 Range / 缓存头 / 404 / 路径穿越）
docker run -d --name nginx-vt -p 8877:80 \
  -v "//d/AItrade/ai-math-mistake-machine/frontend/public/videos:/data:ro" \
  -v "//d/AItrade/ai-math-mistake-machine/.workbuddy/seek-test:/srv:ro" \
  -v "<conf>:/etc/nginx/conf.d/default.conf:ro" nginx:alpine
# playwright-core（需 npm i -g playwright-core）复用 agent-browser 已下载的 Chrome
executablePath: 'C:/Users/Administrator/.agent-browser/browsers/chrome-153.0.8010.36/chrome.exe'
```
**判据不要只看类型检查**：视频类改动要看 `currentTime` 是否自行前进、`paused`、`videoWidth`（画面是否真的解码）。

**测试代码自身的坑（踩过，拖慢两轮）**：
- **测 seek 必须每个点用全新独立 `<video>` 元素** —— 复用已在播放的主元素会让 play/pause 与事件监听互相干扰，`seeked` 正常触发但读回 `currentTime` 恒为 0（假阳性"卡顿"）
- **不要用 `waitFor(() => !v.seeking)` 判 seek 完成** —— 赋 `currentTime` 后 seek 是异步提交的，赋值那一瞬 `v.seeking` 仍为 false，第一次检查就返回 true。用 `seeked` 事件最可靠
- **headless Chrome 的媒体管线会让 `currentTime` 赋值被静默忽略**（赋值后立刻读回 0）→ 测拖动**必须 `headless: false`**，并加 `--disable-gpu`
- **headed Chrome 跑前先清残留进程**（`Get-Process chrome | Stop-Process -Force`），否则报 `Target page, context or browser has been closed`
- **测试页要由同一个服务同源提供再 `page.goto()`**，不要用 `page.setContent`（base URL 是 about:blank，跨域且会卡住）
- **Docker 挂载 Windows 路径用 `//d/...` 形式**；`/tmp/xxx.conf` 会被当目录 → `not a directory` 报错，改放项目内路径
- **测试失败时先怀疑测试代码，别急着改产品**



## 前端样式工作约定（2026-09-15 确立）

- **`frontend/app/camp/shared.css` 是刻意单行压缩的，禁止对它跑 `prettier --write`** —— 会把 955 行展开成 4000+ 行，diff 彻底污染（踩过一次，已 `git checkout` 回退）。改这个文件只做精确行替换。
- **调色/判断"看不看得见"必须算对比度，不要靠肉眼**：用 `.workbuddy/contrast_check.py`（WCAG 相对亮度）。
  实测教训：黄 `#ffd447` on 米白 `#f5f2e9` 只有 **1.27** —— 看着"有颜色"，实际等于隐形。

## 作品墙「精选」的设计约定（用户已明确定调，勿再改）

**精选不做专属专区，保持便签墙一套视觉语言。** 精选只做两件事：
1. **便签墙内置顶**（排序：`featured` 优先 → `sortOrder` → 用户选 latest/hot；**有搜索词时不特殊化**）
2. **卡片右上角挂 `.work-note-flag`「★ 精选」小角标**，让用户知道它为什么在最前

**踩过的坑（用户明确要求回退）**：
- 曾给精选做深蓝底专属专区 → 用户反馈「精选之后的贴纸风格没有原来好看了」
- **真实根因不是配色，而是 `mapDbWork` 把精选硬编码成 `--yellow --hero`** →
  所有精选卡样式完全相同，破坏便签墙黄/蓝/纸白交错的随机感
- **修复方式：精选回归 `VISUAL_CLASSES[index % 3]` 循环**，与普通作品共用配色

> 教训：用户说"风格变丑"时，先查是不是**某类卡片被强制统一了样式**，而不是急着调颜色。

- **改 JSX 类名后跑 `.workbuddy/check_classnames.py`**，核对 JSX 用到的类名在 CSS 里都有定义、且无残留。
- **本地跑不起 `next build` / `next dev`（沙箱 `safe-delete` 守卫误判）**：删单个文件会按文件内行数被算成批量删除而拦截。表现为
  `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":643,...,"targetCount":1}`。
  Turbopack 另有 `RangeError: Maximum call stack size exceeded`（`RegExp.exec`）问题。
  → **本地验证走静态对照预览**（`.workbuddy/preview-featured.html` 那种，直接引用真实 CSS 变量）；**构建放服务器做**。
- 轻量验证顺序：`tsc --noEmit`（基线 **54**）→ CSS 花括号平衡 → 类名交叉核对 → 静态预览。

## 作品墙「精选」视觉层级

精选作品**同时出现在两处**，两处都要能一眼认出（曾经只在专区有标识，便签墙里置顶却无标识）：
- 精选专区 `.works-featured`：`navy-950` 深底 + 上下 3px 黄边 + `.works-featured-badge` 黄底角标 + `.works-featured-flag` 卡片角标
- 便签墙置顶卡：`.work-note--yellow work-note--hero` + `.work-note-flag`「★ 精选」
**不要再把精选区做成"和便签墙同底的浅色卡片"** —— 那正是"精选不明显"的原因（同底对比度 1.00）。

## `frontend/lib/db.ts` 迁移铁律（2026-09-15 事故后确立）

**事故**：生产 `/camp/works` 500，真因 `SqliteError: no such column: viewCount`，日志几乎无痕，潜伏到用户访问才爆发。

**机制（务必记住）**：
- `CREATE TABLE IF NOT EXISTS` 表已存在时**整条语句跳过，不会补新列** → 老库补列只能靠 `ALTER TABLE ADD COLUMN`
- **`db.exec()` 多语句批次是「全有或全无」**：批次内任一语句抛错，**其后所有语句都不执行** → 一条坏语句能静默废掉整批迁移
- `getDb()` 是**双层**结构：init block（`if (!_dbInit || !tableExists(...))` 门控，**开过一次就不再跑**） vs `applyMigrations(_db)`（**每次 `getDb()` 都跑**）。**补列逻辑必须放 `applyMigrations`**
- `PRAGMA table_info()` 读源表列**必须在 `RENAME` 之前**（`camp_works_old` 要 RENAME 后才存在）

**写迁移的规矩**：
1. 建索引若依赖新列，**绝不能与 `CREATE TABLE` 同批次** → 下沉到 `applyMigrations`，晚于补列执行
2. 补列/建索引一律用 `migrate(db, sql, label)` helper（已内置）：`already exists` / `duplicate column name` 静默跳过，**其余错误 `console.error`**
3. 禁止空 `catch {}` 吞错；`applyMigrations` 里也不要 `throw err`（会拖垮后续全部迁移）
4. 表重建迁移必须 `PRAGMA table_info` **动态取列**并对新列 `COALESCE`，别硬编码列名
5. 新增关键列时，**同步在 `applyMigrations` 末尾的自检数组里登记**（当前：`viewCount/grade/htmlFile/editToken/coverSource`）
6. `camp_works.studentId` 为**可空**（学生可匿名提交）→ 新库 schema 别再写 `NOT NULL`，否则触发重建迁移

**验证资产**（`.workbuddy/`，可复用）：`prod_schema.json`（生产 18 表建表 SQL）、`verify_migrate.js`（5 场景单测）、`verify_prod_upgrade.mjs`（真实 prod schema 还原故障现场 → 验证自愈）、`repro_camp_works.js`、`chk_prod.js`。

**排查手法**：
- SSH 传引号给 `node -e` 会被 Git Bash 反复吃掉 → 用 `cat > f.js` + `docker compose cp` + `exec node /app/f.js`
- 容器内 `better-sqlite3` 在 `/app/node_modules/better-sqlite3`；本地脚本要 `cp` 进 `frontend/` 才解析得到
- `/tmp` 在 Git Bash 与 Python 间解析不同 → 统一用仓库内绝对路径
- 判「生产库最近改了什么」看 `-wal` 文件时间，主库文件时间戳会滞后（WAL 模式）
- **生产库有同目录干扰项**：`studymate.db` 是 0 字节空壳，真库是 `studymate.sqlite`

## B站视频采集（可复用流水线）

创造营课程视频优先取自 B站，需绕过风控与字幕真伪两大坑。脚本在 `.workbuddy/bili/`（**含登录 cookie，已 gitignore**）。

- **space 接口 412 风控**：拉某 UP 主投稿必须 **WBI 签名 + 登录 cookie** 双管齐下。裸抓 space 页只有登录墙。
  - WBI：nav 接口取 `wbi_img.img_url`/`sub_url` → 取文件名拼 64 字符 → 按 `MIXIN_KEY_ENC_TAB` 重排取前 32 位 = `mixin_key` → 参数按 key 排序 urlencode + `wts` + mixin_key 求 md5 = `w_rid`
  - 脚本：`extract_cookies.py`（Chrome/Edge DPAPI + AES-256-GCM 解 cookie）、`fetch_uploader.py`（WBI 拉列表）
- **Chromium cookie DB 独占锁**：浏览器运行时读不到，`cp` 报 busy、`CreateFileW` 报 err=32。**用 `shutil.copy2` 快照到临时文件再只读打开**。Chrome 真实库在 `Default/Network/Cookies`（`Default/Cookies` 是 0 字节空壳）。
- **判断能否做中文版：只看 `ai-zh` 轨，别只看画面有无烧录** —— 这是最省事的准入判据：
  `yt-dlp --cookies cookies.txt --list-subs "https://www.bilibili.com/video/$BV/"`，输出含 `ai-zh srt` 即可用。
  **曾把「小丸子饲养员MYA」判死（画面无烧录字幕），但该 UP 每条都带 `ai-zh` 轨 → 自己烧录后完美可用。教训：结论别下太窄。**
- **自行烧录中文字幕**（`.workbuddy/bili/build_zh.py`）：下载 `30032(avc1 480p)+30280` + `--write-subs --sub-langs ai-zh --convert-subs srt`，再 `ffmpeg subtitles` filter 以微软雅黑烧录。样式：`FontName=Microsoft YaHei,FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=18`。**坑：srt 路径含空格/中文会失败 → 先复制到无空格的 `_tmp.srt`；盘符冒号转义 `C\\:/`。**
- **标题是中文 ≠ 有中文字幕**（曾误判 70 条中文标题实际画面纯英文）。抽帧复核：`ffmpeg -i in.mp4 -vf "fps=1/8,crop=iw:ih*0.25:0:ih*0.75,scale=700:-1,tile=3x3" -frames:v 1 grid.png -y`
- **27 个课题已 100% 中文字幕覆盖**（2026-09-15 commit 58eadbb）。来源 UP：AstroNova官方(3546677931674532)、CaptainHohohoho(14095498)、小丸子饲养员MYA(347119663)。小频道 space 接口全 412 → 用搜索接口 `.workbuddy/bili/search_bili.py`，**关键词用英文原名全称**（如 `The Arctic Conundrum`）避开大模型新闻污染。
- **写 heredoc 里的 Python 替换脚本要当心字面量被 shell 篡改**：`}}],` 这类含花括号/反斜杠的搜索串可能被改写导致替换 0 处却无报错。**用 `chr(0x7d)+chr(0x7d)+...` 构造最稳**；替换后必须独立复核（`src.count(old)` + `tsc`）。
- **TS 单引号字符串里出现裸 ASCII 双引号会提前终止字符串**（如 `'写"它见证了什么"'`）→ 改用中文引号 `「」`。本项目曾有 7 处 + 9 处 `}},]` 括号错误叠加，导致 `tsc` 报 319 个语法错（全项目基线是 54）。
- **yt-dlp 传 BV 号必须用完整 URL**；**format id 必须手写**：`30032`=480 avc1（Safari 可播）、`30033`=480 hvc1（HEVC，播不了）、`30064`=720 avc1、`30080`=1080 avc1、`30280`=音频。用 `bv*[height<=720]` 会匹配到 HEVC。
- yt-dlp 在 `C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/Scripts/yt-dlp.exe`（曾丢失，`pip install yt-dlp` 可装回）。
- 课题视频映射：`frontend/lib/camp/conundrums.ts` 的 `id` ↔ `frontend/public/videos/conundrums/<id>.mp4` ↔ `LOCAL_VIDEO_IDS`，页面 `src={`/videos/conundrums/${c.id}.mp4`}`。**替换 mp4 即生效，无需改页面**；同时更新 `manifest.json` 与 `bilibiliVideos` 首位引用。

## 记忆盲区提醒

下次梳理"产品矩阵"型项目前，先 grep 一遍产品关键字（品牌名、域名、备案号、学员名），再决定讲几条线，不能只看 SKILL.md/AGENTS.md 就认定项目范围。