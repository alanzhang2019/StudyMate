# StudyMate Monorepo 项目记忆

## 项目一句话
StudyMate（作业通，aijiangti.cn）— K12 AI 学习闭环 monorepo，**三产品线共存**。

| 产品线 | 入口 | 关键事实 |
|---|---|---|
| 小学 4-6 年级数学错题讲解 | `/mistake`、`/generation-preview` | 后端 3000 / 前端 3001；启发式诊断 + LLM |
| CSP 真题训练 | `/csp-lecture`、`/classroom/[id]` | 10 学员 A/B/C/D 梯队；Vjudge-AI-report C++ 接入（subject='cpp'） |
| 少年 AI 创造营（7-12 岁） | `/camp`、`/camp/works`、`/camp/submit` | Alan张老师个人品牌；工具栈 **Trae + WorkBuddy**；2000+ 学员作品 / 15 年教学经验 |

**品牌红线**：创造营对外统一 **Alan张老师**，资产/类名已为 `alan-` 前缀；**勿新增 `xgls-`**，勿恢复 XIAOGAO LAB / ICP / 公安备案字样。
**「少年 AI 创造营」完全独立于「涌现智训 / Emergix」**（后者是 B 端企业培训）。

## 部署

- 服务器路径 `/home/ubuntu/studymate`：`git pull origin master && docker compose up -d --build frontend`（传课件需补 `sudo frontend/scripts/fix-bind-mount-perms.sh`）
- **深圳教材模块**（2026-09-15）：89 册 1.7GB PDF 在 `frontend/data/textbooks/`（gitignore + dockerignore，git pull/build 不动它），nginx `/textbooks/` 直出；元数据 `frontend/lib/textbooks.ts`（数学北师大/英语沪教牛津/科学教科/地理湘教为深圳在用版本）；**文件名必须全 ASCII slug**

## 易漏点（踩过的坑）

- **同一条消息里对同一文件发多个 Edit 会静默丢失改动**（返回成功但没落盘）。多改动用 Read + Write 重写，或逐个 Edit 分消息；提交前 grep/diff 核对。
- **Next.js 15+ 动态路由 `params` 是 Promise**，`page.tsx` 与 `route.ts` 都要 `await params`。
- `frontend/app/camp/shared.css` 刻意单行压缩，**禁止 prettier**。
- 调色必须算对比度（`.workbuddy/contrast_check.py`），别靠肉眼。
- **本地跑不起 `next dev`/`next build`**（沙箱 safe-delete 守卫按行数误判）；`tsc --noEmit` 基线 **54**，构建放服务器。
- **本机 curl 被沙箱 http_proxy 劫持**（全返回 000/404）→ 在服务器或容器内测才准。
- **PowerShell 沙箱拦 `.ssh`**：scp/ssh 用 Bash 工具跑。
- **沙箱 git 输出可能是假的**（说 nothing to commit 其实已建 commit）→ 用 `git log --oneline -1` + `git ls-remote` 对账补推。
- 作品墙精选：**不做专属专区**，只做便签墙内置顶 + 角标；回归 `VISUAL_CLASSES[index % 3]` 循环。用户说"风格变丑"先查是不是某类卡片被强制统一样式。

## Nginx（`nginx/studymate.conf`）

**⚠️ nginx 不在 docker-compose 里**：宿主机 apt 安装，配置在 `/etc/nginx/sites-enabled/studymate.conf`；生效方式 `sudo cp` + `nginx -t && nginx -s reload`。

**头号坑：conflicting server name 会静默吞掉整个配置文件。** certbot 的 `sites-enabled/default` 与 studymate.conf 曾同时声明 `aijiangti.cn:80`，default 先加载 → studymate.conf 的 server 块被**整体忽略**（`nginx -t` 只 warning）。**后果：/videos/ 直出配置写了很久从未生效。** 新增 location 不生效时，先查有无第二个文件声明相同 `server_name:port`。

**五个坑**：① 子 location 的 `add_header` 覆盖父级 → COOP/COEP 必须重复声明 ② 别写 `expires`（与 Cache-Control 互盖）③ 别手工加 `Accept-Ranges`（静态模块自带）④ `try_files $uri =404` 不能回落 HTML ⑤ **`alias` 在正则 location 下会丢文件名** → 必须用**前缀 location + `if ($request_uri !~ ...)` 白名单**（白名单用未解码的 `$request_uri` 挡编码穿越）。`nginx -t` 通过 ≠ 行为正确，必须起容器实测。

| 资源 | 服务方式 | 缓存 |
|---|---|---|
| 课题视频 `public/videos/` | nginx `/videos/` 直出 | 30d |
| 作品视频 `data/camp-videos/` | nginx `/api/camp/videos/` 直出 | 365d |
| 封面 `data/camp-covers/` | Next.js `readFileSync` | 365d |

**封面几百 KB 用 readFileSync 没问题，视频绝不能照抄** → 必须 `createReadStream` + Range。改卷挂载必须 `up -d` 重建，且先备份命名卷。

## `frontend/lib/db.ts` 迁移铁律

`CREATE TABLE IF NOT EXISTS` 对已存在表**整条跳过，不补列**；`db.exec()` 多语句批次**全有或全无**（一条坏语句废掉整批）；`getDb()` 的 init block 只跑一次，**补列必须放 `applyMigrations`（每次都跑）**。

1. 依赖新列的索引**不能与 CREATE TABLE 同批次** 2. 一律用 `migrate(db, sql, label)`（已存在则静默跳过）3. 禁止空 catch 4. 表重建用 `PRAGMA table_info` 动态取列 + `COALESCE` 5. 新列登记进末尾自检数组 6. `camp_works.studentId` 可空。
排查：生产真库是 `studymate.sqlite`（`studymate.db` 是 0 字节空壳）；看 `-wal` 时间判断最近改动。

## B站视频采集（`.workbuddy/bili/`，含 cookie 已 gitignore）

- space 接口 412 → 需 **WBI 签名 + 登录 cookie**；小频道用搜索接口，关键词用英文原名全称
- **准入判据只看 `ai-zh` 轨**（`yt-dlp --list-subs`），别只看画面有无烧录——曾误判有轨的 UP 不可用
- Chromium cookie 库运行时独占 → `shutil.copy2` 快照后只读打开；真实库是 `Default/Network/Cookies`
- format id 必须手写：`30032`(480 avc1) / `30080`(1080 avc1) / `30280`(音频)；用 `bv*[height<=720]` 会匹配到播不了的 HEVC
- 自行烧录用 `ffmpeg subtitles`，srt 路径不能有空格/中文；`}}],` 类字面量用 `chr()` 构造防 shell 篡改
- 课题视频：换 `public/videos/conundrums/<id>.mp4` 即生效，同步 manifest.json

## AI 原生教育（内容线，2026-09）

**三步走**：① 翻转课堂「假如我来讲\_\_课」（数学为主先跑通）② 27 个真实难题 ③ 白名单赛事/黑客松出口。
**核心句**：**AI 不是替孩子学，是让孩子第一次够得着讲台**；「不是编程不重要了，是让信奥成为最优解的前提正在消失」。

**白名单赛事：47 项里真正对口 4 项**（其余多��硬件或现场答题）：
| 赛事 | # | 对口点 |
|---|---|---|
| 全国青少年人工智能大赛 | 18 | **「人工智能工具应用大赛」是唯一小学可参加的"用 AI 工具做东西"赛道** |
| NOAI 人工智能创新挑战赛 | 1 | 小学分组；数字化方向收作品，**线上选拔+视频答辩** |
| 全球发明大会 ICC | 17 | 主题含「AI 与生活」；交**发明日志**（对应五阶段过程记录） |
| 人工智能辅助生成数字艺术创作者大赛 | 45 | AIGC 数字艺术，小学到中职 |

**排除**：全国青少年科技创新大赛 **仅高中+中职**（小学不能参加，常误以为可以）；NOI/五大学科奥赛/丘成桐均仅高中；AILD 与信息素养类以答题为主。
**2026 赛季已结束，下一轮 2027 年 3-6 月报名。**
**合规**：白名单明文不得作为招生入学依据/高考加分；严禁机构代报名、代做作品。

**公众号首篇**已存后台草稿 `appmsgid=100000322`（未发表）；流程固化在 skill `wechat-mp-cdp-publish`（**别用 playwright 连 CDP，会握手卡死**，用 Node 原生 WebSocket）。

## 记忆盲区提醒
梳理"产品矩阵"前先 grep 品牌名/域名/备案号/学员名，别只看 SKILL.md 就认定项目范围。
