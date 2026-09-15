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

## 易漏点（踩过的坑）

- backend/startup/runStartup.ts 默认 `FE_ROOT=D:\AItrade\AI-MATH-MISTAKE`，但当前仓库是 `D:\AItrade\ai-math-mistake-machine\frontend`，需要 `FE_ROOT` 环境变量覆盖
- 部署时必须把 `frontend/data/classrooms/*.json` 同步进 named volume 并 `chown nextjs:nodejs`，否则新课件看不见
- `backend/app/` 目录名是 Next.js App Router 风格但不一定被 Next.js 编译，是给前端 monorepo 共享用的占位组件
- "少年 AI 创造营"完全独立于"涌现智训 / Emergix"（涌现智训是 B 端企业培训，是另一个人设；少年 AI 创造营是 C 端 7-12 岁启蒙）
- **Next.js 15+ 动态路由 `params` 是 Promise**：App Router 的 `page.tsx` 和 `route.ts` handler 都必须 `await params`，否则 `[id]` 路由取到的 `id` 是 undefined，导致 findUnique 404。本项目已因此在 `admin/camp/works/[id]` 审核时报"作品不存在"。
- 少年 AI 创造营对外品牌统一为 **Alan张老师**（C 端 7-12 岁启蒙），代码里资产/类名已统一为 `alan-` 前缀；**勿再新增 `xgls-` 引用**，也勿在页面恢复 XIAOGAO LAB / 苏ICP备 / 苏公网安备 字样（用户已要求移除）。
- **同一条消息里对同一文件发多个 Edit 会静默丢失部分改动**（返回"Successfully edited"但没落盘），已踩 2 次（handleShare、HTML 上传功能）。**同文件多改动用 Read 完整 + Write 重写，或逐个 Edit 分开发消息；提交前 grep/git diff 逐点核对。**
- 自动封面依赖 `resolveImageApiKey('seedream')`（读 server-providers.yml 或 env）；生产 docker-compose 只显式配了 KIMI_API_KEY，**未配 seedream 图生 key** → 自动封面会静默跳过（coverSource='none'，学生可手动上传）。需在服务器确认 SEEDREAM key 是否已配。

## B站视频采集（可复用流水线）

创造营课程视频优先取自 B站，需绕过风控与字幕真伪两大坑。脚本在 `.workbuddy/bili/`（**含登录 cookie，已 gitignore**）。

- **space 接口 412 风控**：拉某 UP 主投稿必须 **WBI 签名 + 登录 cookie** 双管齐下。裸抓 space 页只有登录墙。
  - WBI：nav 接口取 `wbi_img.img_url`/`sub_url` → 取文件名拼 64 字符 → 按 `MIXIN_KEY_ENC_TAB` 重排取前 32 位 = `mixin_key` → 参数按 key 排序 urlencode + `wts` + mixin_key 求 md5 = `w_rid`
  - 脚本：`extract_cookies.py`（Chrome/Edge DPAPI + AES-256-GCM 解 cookie）、`fetch_uploader.py`（WBI 拉列表）
- **Chromium cookie DB 独占锁**：浏览器运行时读不到，`cp` 报 busy、`CreateFileW` 报 err=32。**用 `shutil.copy2` 快照到临时文件再只读打开**。Chrome 真实库在 `Default/Network/Cookies`（`Default/Cookies` 是 0 字节空壳）。
- **判断「真有中文字幕」只能抽帧看图** —— **标题是中文 ≠ 有中文字幕**（曾误判「小丸子饲养员MYA」70 条中文标题，实际画面纯英文）。抽帧：`ffmpeg -i in.mp4 -vf "fps=1/8,crop=iw:ih*0.25:0:ih*0.75,scale=700:-1,tile=3x3" -frames:v 1 grid.png -y`
- **yt-dlp 传 BV 号必须用完整 URL**；**format id 必须手写**：`30032`=480 avc1（Safari 可播）、`30033`=480 hvc1（HEVC，播不了）、`30064`=720 avc1、`30080`=1080 avc1、`30280`=音频。用 `bv*[height<=720]` 会匹配到 HEVC。
- yt-dlp 在 `C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/Scripts/yt-dlp.exe`（曾丢失，`pip install yt-dlp` 可装回）。
- 课题视频映射：`frontend/lib/camp/conundrums.ts` 的 `id` ↔ `frontend/public/videos/conundrums/<id>.mp4` ↔ `LOCAL_VIDEO_IDS`，页面 `src={`/videos/conundrums/${c.id}.mp4`}`。**替换 mp4 即生效，无需改页面**；同时更新 `manifest.json` 与 `bilibiliVideos` 首位引用。

## 记忆盲区提醒

下次梳理"产品矩阵"型项目前，先 grep 一遍产品关键字（品牌名、域名、备案号、学员名），再决定讲几条线，不能只看 SKILL.md/AGENTS.md 就认定项目范围。