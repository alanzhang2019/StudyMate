# StudyMate Monorepo 记忆

## 项目
StudyMate（作业通 aijiangti.cn）K12 AI 学习闭环 monorepo，三产品线共存：

| 产品线 | 入口 | 关键 |
|---|---|---|
| 小学 4-6 数学错题讲解 | `/mistake`、`/generation-preview` | 后端 3000 / 前端 3001；启发式诊断 + LLM |
| CSP 真题训练 | `/csp-lecture`、`/classroom/[id]` | 10 学员 A/B/C/D 梯队；Vjudge-AI-report C++ 接入 |
| 少年 AI 创造营（7-12 岁） | `/camp`、`/camp/works`、`/camp/submit` | Alan 张老师品牌；Trae + WorkBuddy；2000+ 作品 / 15 年 |

**品牌红线**：创造营对外统一 **Alan 张老师**、`alan-` 前缀；**勿新增 `xgls-`**，勿恢复 XIAOGAO LAB / ICP / 公安备案字样。与「涌现智训 / Emergix」（B 端企业培训）完全独立。

## 部署与内容
- 服务器 `/home/ubuntu/studymate`。**线上 3001 由 `docker run` 手动容器 `studymate-frontend` 服务**（unless-stopped），挂载布局与 compose 一致：`/app/data` = 现役卷 `studymate_studymate-frontend-data`（DB/封面都在），`/app/data/camp-videos` = **宿主机 bind `frontend/data/camp-videos`**（深层 bind 遮蔽卷子目录，视频落宿主机，**必须纳入备份**）。⚠️ Docker 挂载按目标深度排序，深层 bind 生效——勿再说「compose 里命名卷声明在后会覆盖子路径绑定」。杂卷：裸 `studymate-frontend-data`（无用可清）。2026-09-18 作品视频 404 事故：视频曾被写进前缀卷被 bind 遮蔽，docker cp 进容器（落宿主机 bind）恢复
- **深圳教材模块**：89 册 1.7GB 在 `frontend/data/textbooks/`（gitignore + dockerignore），nginx `/textbooks/` 直出；**文件名必须 ASCII slug**；元数据 `frontend/lib/textbooks.ts`

## 易漏点
- 同文件并行多个 Edit 会丢改动 → Read + Write 重写，提交前 diff 核对
- **Next.js 15+ `params` 是 Promise**，page/route 都要 `await`
- `frontend/app/camp/shared.css` 单行压缩，**禁 prettier**
- 调色算对比度（`.workbuddy/contrast_check.py`），别靠肉眼
- 本地跑不了 `next dev`/`next build`（沙箱守卫按行数误判）；`tsc --noEmit` 基线 54，构建放服务器
- 本机 curl 被沙箱 http_proxy 劫持 → 在服务器/容器内测
- PowerShell 沙箱拦 `.ssh` → scp/ssh 用 Bash
- 沙箱 git 输出可能是假的 → `git log -1` + `git ls-remote` 对账
- **`docker cp` 嵌套坑**：`docker cp SRC C:/app/data/exam-papers` 当目标目录已存在时会把源目录嵌套成 `exam-papers/exam-papers`（每轮部署翻倍）。正确：`docker exec <c> mkdir -p /app/data/exam-papers` 后 `docker cp "$SRC/." "<c>:/app/data/exam-papers/"`（仅拷内容，幂等不嵌套）。容器内默认 exec 用户是 `nextjs` 非 root，删文件要 `docker exec -u 0`。
- 真题/doc 等非 git 数据若靠命名卷持久（非 bind），**必须**在 `deploy-prod.sh` 里 docker cp 兜底（现第 7/9 步），否则换卷/重建会丢。
- 作品墙精选不做专区，只便签墙置顶 + 角标；`VISUAL_CLASSES[index % 3]` 循环

## Nginx（宿主机 `/etc/nginx/sites-enabled/studymate.conf`，**不在 compose 里**）
**头号坑：conflicting server name 会静默吞掉整个 conf**（certbot `default` 曾与 studymate.conf 同声明 `aijiangti.cn:80`，导致直出配置长期未生效）。新增 location 不生效先查重复 `server_name:port`。
**五坑**：① 子 location 的 `add_header` 覆盖父级 → COOP/COEP 重复声明 ② 别写 `expires` ③ 别手工加 `Accept-Ranges` ④ `try_files $uri =404` 不回落 HTML ⑤ 正则 location 下 alias 丢文件名 → 用**前缀 location + `if ($request_uri !~ ...)` 白名单**。`nginx -t` 通过 ≠ 行为正确。
**直出**：课题视频 `/videos/`（30d）。作品视频 `/api/camp/videos/` 的 nginx 直出已**删除**（2026-09-18，方案 B），改走 Next.js 路由（流式 + Range，与封面同套路）——勿在 nginx 里恢复该 location。封面可 readFileSync，**视频必须 `createReadStream` + Range**。

## `frontend/lib/db.ts` 迁移铁律
`CREATE TABLE IF NOT EXISTS` 对已存在表整条跳过；`db.exec()` 批次全有或全无；**补列只能放 `applyMigrations`**。依赖新列的索引不与建表同批次；一律用 `migrate(db, sql, label)`；禁止空 catch；表重建用 `PRAGMA table_info` + `COALESCE`；`camp_works.studentId` 可空。生产真库 `studymate.sqlite`（`studymate.db` 是空壳）。

## B 站采集（`.workbuddy/bili/`，cookie 已 gitignore）
space 接口 412 → 需 **WBI 签名 + 登录 cookie**；准入只判 `ai-zh` 轨；Cookies 库运行时独占 → `shutil.copy2` 快照；format 手写 `30032/30080/30280`（`bv*[height<=720]` 会匹配播不了的 HEVC）；烧录用 `ffmpeg subtitles`，srt 路径无空格中文。

## AI 原生教育内容线（2026-09）
**三步走**：① 翻转课堂「假如我来讲\_\_课」（数学为主）② 马斯克 Astra Nova 式 27 个真实难题 ③ 白名单赛事 / 黑客松出口。
**核心句**：AI 不是替孩子学，是让孩子够得着讲台；「不是编程不重要了，是让信奥成为最优解的那个前提正在消失」；信奥 42 年最宝贵的是**自主学习能力的最佳实践**，AI 时代更稀缺的是**持续学习的热情**（能力可以练，热情只能被保护）。
**白名单 47 项里真正对口 4 项**：人工智能大赛 #18（唯一小学可参加的"用 AI 工具做东西"赛道）、NOAI 挑战赛 #1（线上选拔+视频答辩）、ICC 全球发明大会 #17（交发明日志）、AIGC 数字艺术 #45。**排除**：科技创新大赛仅高中+中职；NOI/五大学科/丘成桐仅高中。2026 赛季已结束，下轮 2027 年 3-6 月报名。合规：不得作招生入学依据/高考加分，严禁代报名代做。
**公众号首篇**存后台草稿 `appmsgid=100000322`（未发表）；流程固化在 skill `wechat-mp-cdp-publish`（**别用 playwright 连 CDP，会握手卡死**）。
**隐私**：公开物料孩子姓名只写名不写姓。

## 盲区提醒
梳理"产品矩阵"前先 grep 品牌名 / 域名 / 备案号 / 学员名，别只看 SKILL.md 认定项目范围。

## 数据拓扑与保护（2026-09-18 钉死）
- **数据库+封面唯一存放地**：命名卷 `studymate_studymate-frontend-data`（compose 声明 `studymate-frontend-data`，磁盘名被项目名 `studymate` 前缀化）→ 容器 `/app/data`。**不在 git、不在宿主机普通目录**，删卷即永久丢失账号/进度/封面。
- 视频：`~/studymate/frontend/data/camp-videos`（宿主机 bind，受主机备份保护）。
- 课件/静态：`frontend/data/classrooms`、`frontend/public`（bind + git 工作区）。
- **禁手操作**：`docker compose down -v`、`docker volume rm studymate_studymate-frontend-data`、`docker volume prune`。重启只用 `docker compose down`（无 -v）。
- 定期备份：卷 tar 快照（`docker run --rm -v <卷>:/data -v ~/backups:/backup alpine tar czf ...`）+ 主机 camp-videos tar。
- 调试期裸卷 `studymate-frontend-data`（无前缀）含 8 视频冗余拷贝，暂留作第二备份。
