# 爱讲题 / hl-platform / StudyMate 记忆（精简版）

> 跨会话可复用的**结论与红线**。批次流水见 `.workbuddy/memory/2026-*.md` 日 log。
> 本工作区 `ai-math-mistake-machine` = GitHub 仓 `alanzhang2019/StudyMate`（前端 master 分支，push 即部署 `/`）。hl-platform(`/ai`)是**独立服务器仓**，不在本 GitHub 仓；其 fixtures 以 `_bXXX/` 暂存本工作区（属 hl 线，勿混入 StudyMate 提交）。
> 线上三部署线：StudyMate(`/`,master) · hl-platform(`/ai`,独立仓) · wrong-notebook(`/wrong-notebook`,third-party,需 compose build)。

## 对外展示名 / 公告
- ★★ 给用户看的名字/数字必须从"当前生效值"反推（`llm.modelLabel(effectiveModel(id))`），不许抄 `MODELS` 常量。
- ★★ 未读数字口径必须与文案同一变量（`unreadAnnouncementCount()` 全级别 + 打开即已读覆盖所有级别）。
- 档位名不副实时退回中性功能位名（deep 真身换 Kimi ⇒ 「深度思考」）。
- ★★★ 「写了某条 CSS」≠「它赢」：判据不能 grep 源码，须真 Chromium 读 computed style 或 CSS 层叠解析（`!important→权重→顺序`）。`.me-mi .me-badge` 须显式兜底。
- 站内公告：草稿→`publishAnnouncement()` 才上线；正文转义纯文本+pre-wrap，不支持 Markdown；已发布删不掉，`announcement_reads` 为 0 行时可就地修订（同 id，created_at/已读不变）。
- 对外版本号 = `package.json` CalVer `version`。

## 模型档位 / 上游网关
- 网关 `https://api.qnaigc.com/v1`，`LLM_MODEL=deepseek/deepseek-v4-flash-20260731`，`LLM_MODEL_DEEP=v4-pro-0813`；后台改档位写 meta `llm:model:{default,deep}`+`llm:model:candidates:*`（覆盖环境变量，立刻生效）。
- ★★ 免费档(`*-free`)不保证容量：诊断=同 Key 打免费档+付费档各 3 次区分「账号配额」vs「该档无容量」。
- 429 分两类（`llm.isCapacity429`）：容量型⇒立刻换候选；账号级 RPM⇒换模型无用须退避。学生侧只许人话（`llm.upstreamError`），原文进 `err.raw`→`model_switches`。
- 写线上真库：宿主机 `hl-platform-data/app.db` 只读 ⇒ 须 `docker exec -e DB_FILE=/data/app.db` 走 `/app/server/db.js`。`D.run(sql,...p)` 是变参，传数组=单值绑定⇒DELETE/UPDATE 静默失效。

## 品牌与产品口径
- 主品牌=爱讲题(aijiangti.cn)；后浪奔涌仅/ai 子品牌；少年AI创造营=/camp；百宝箱=工具入口。slogan「自学立身，创造立世」。
- 视觉：浅色极简(米白#F7F5F0)，不要黑色色块。AI自学=蓝#2B5CFF；AI原生教育=深海军蓝#0F1E3D+亮黄#FFD24A。
- 备案：官网页脚必须有「深圳市中智乐创科技有限公司」+「粤ICP备2023157905号」。
- 红线：对外统一「Alan 张老师」/`alan-`；勿新增 `xgls-`；勿恢复 XIAOGAO LAB。与涌现智训/Emergix 独立。公开物料孩子只写名不写姓。
- ★ 对外物料一律爱讲题；AI原生教育只属/camp。界面文案不暴露技术供应商名（TTS 可换，`public/js/app.js` 零厂商名，`_ttsqueuecheck` 钉住）。

## 🔴🔴 hl-platform 改代码铁律
- 绝不用本地整份 docker cp 覆盖服务器/app；正路：服务器 git 拉 base→本地定点改→git diff 出 patch→服务器 git apply --check 再 apply→grep+node --check 验证。
- 本机验证克隆 `ssh://hl/home/ubuntu/hl-platform`→`.workbuddy/wn-b206/hl-platform`（Node22 内置 node:sqlite）；用前 fetch+对齐 origin/main。Windows 对齐：`git config core.autocrlf false`→`git checkout -q origin/main`→`git rm -r --cached . -q && git reset --hard origin/main -q`（只 checkout-index 修不干净）。
- 提交须 `git add` 定点文件；push 后 `git ls-remote origin main` 对账。并行会话抢批次号：提交前 `git fetch && git log --oneline HEAD..origin/main`。
- ★★★ patch 部署会被并行会话 commit 冲掉：部署后 grep 逐条验证，丢了用 `git diff <服务器HEAD> <本地HEAD>` 出全量 patch 重 apply。
- 重启：只改 `public/js/*.js`/`public/*.css`→不重启；改 `server/*.js`/根 `server.js`→`docker restart hl-platform`。
- ★★★ `server/server.js` 是死副本，一个字节别改（容器 CMD 跑根 `server.js`）。★★ 新增/改 API 路由必须改根 `server.js`（落点抄 `/api/cards/summary` 邻居，根 3034 行一带）；改死副本静默 404。
- 线上 app.js 与仓库 md5 天然不同（nginx sub_filter 改写/ai/）→验证靠 grep 特征不比 md5。直连容器 127.0.0.1:3100：js/css 路径不带/ai/前缀。
- /ai/api/* 需登录⇒容器内直查 DB。真实库=宿主机 `/home/ubuntu/hl-platform-data/app.db`；`require('/app/server/db.js')` 开空壳库。
- 全量 `_run-tests.cjs --skip-browser` 本沙箱非门槛（基线约 95 失败，多反证套件 spawn EBUSY）；改代码前必须停后台全量测试（还原旧内容会写回工作区）。
- 服务器不一定自动 pull：部署固定三步 `git rev-parse --short HEAD` 对账→不对就 `git pull --ff-only`→`docker restart`→grep 验证。
- 容器内 `docker exec node xxx.js` 不加载 .env⇒`llm.js` 掉 MOCK；真模型探针须 `set -a; . /home/ubuntu/hl-platform/.env; set +a; docker exec -e LLM_API_KEY=... -e LLM_BASE_URL=... -e LLM_MODEL=...`。

## 互动课件（两条轨：DSL/原生SVG vs HTML/iframe）
- DSL 轨(`server/interactive.js`+`public/js/interactive.js`)：function-plot/geometry→原生SVG，秒级、可打印、可朗读、零脚本面。HTML 轨(`server/ivthtml.js`+`public/js/ivtframe.js`)：模型产整段自包含 HTML→`<iframe srcdoc sandbox>`，慢(29s/26KB)且开脚本面。
- ★★★ `sandbox` 绝不含 `allow-same-origin`（与 allow-scripts 同给=沙箱失效；作业通 fork 还带，**不要照抄**）。
- ★★★ 不透明源父页面看不见子帧：错误与观察只能靠子帧 postMessage。服务端 `finalize()` 注入 guard(error 监听+MutationObserver 盯 `#experiment` 的 `data-maic-observation`)；父侧须验 `e.source===iframe.contentWindow`。
- ★★ 模型必给 HTML 包一层（开场白+```html 围栏+Optimization Tip）⇒ 从首个 `<!DOCTYPE` 切到末个 `</html>`。
- ★ iframe 无显式尺寸塌成 300×150 ⇒ 关键尺寸内联兜底。
- ★ 长任务(>30s)不许在 HTTP 请求里 await：返 jobId+后台跑+前端长轮询；`chat.failJob` 写 `'failed'`（非 `'error'`），轮询只认 done/error 会白等满轮。
- **五类 widget(simulation/diagram/code/game/visualization3d)**：OpenMAIC 四类提示词冲突「零外链+CSP default-src 'none'+不留存」⇒ code 只做 JS 原生执行、3D 用 canvas2D 自写投影、game 进度只放内存。**code 类必须在 Worker 执行用户代码+主线程 3s 超时 terminate**（学生写死循环常态）；CSP 加 `worker-src blob:; child-src blob:`。**guard 必须过滤 `ResizeObserver loop…` 良性告警**（误报比漏报更伤）。控件 id 钉死(`editor/btnRun/btnReset/btnHint/output`)。自动选类 `pickWidget()` 失败回落 simulation。
- **自动链路(零点击)**：`ivthtml.shouldAuto`→`server.js._startAutoHtml`→`attachToMessage` 存 `autoOpen` 标记(须存在附件里，不能只走 SSE)→前端 `onArtHint`/`appendArtifact`/`watchIvtJob`。强档排 `shouldIllustrate` 前；失败当场收场(`watchIvtJob` 轮询 failed 即 `cancelPending`)。闸门保守：正文≥160字+讲解性≥2+主题词≥2，排除纯结果型/文科；`IVT_HTML_AUTO=0` 关，同对话 90s 节流。
- **观察桥**：三段世界(iframe→ivtframe→app 状态条)。新增结构化字段路由透传须单独写断言(漏 `observation` 零报错)；走独立字段不进消息文本(10min 保鲜 `sanitizeObservation`)；state 是模型自由 JSON，须限字段/限长/限类型/限12键再进提示词。观察只走 `ivtframe.onObservation` 总闸；`#ivtObs` 状态条显示"看到什么+来自哪个课件"+×。
- **生成三坑**：①上游默认 `max_tokens=4096` 而课件要~4900 ⇒ 截断半截 `</html>` 没写出⇒提取空⇒整份作废；`ivthtml.MAX_TOKENS` 默认 16384(首/重试都带)，重试文案区分"写得不对"vs"没写完"。②动画每帧发观察(58条/2.5s)⇒提示词禁+前端签名相同不重画/300ms 收敛(58→2)。③课件按 100vh 垂直居中 ⇒ 宿主 420-680px 浮动时上下同裁；COMMON_QUALITY 要求从上往下排、别 `justify-content:center`、`overflow:auto`。
- **判定松紧须拿真实数据审计**：599 条判"该做"里 513 条是 code 且前排是苏格拉底式追问(平台主体 C++/CSP-J)⇒四道新闸 `AUTO_DIALOGUE`(追问/纠错词≥2)、问号≥3、`AUTO_DELIVERY`(存成/直接复制/完整版/替换整个)、`AUTO_MIN_HITS.code=3`，留 `ex>=4` 口子；GO 599→155(4.7%)。
- **批次286 补9-补12(用户实测触发)**：数学讲解被判"没有主题"→根因 `AUTO_TOPICS` 缺数学/统计词+无兜底。补数学词(面积/方程/因数/比例/统计/平均…)+长讲解兜底(≥600字+ex≥2)+LaTeX密度算解释性+'试试看'不算追问。验证：真库 乘法公式/平方差 704字 现 `go=true`；分数除法/因式分解(追问链)/统计图/坐标系(已有 svg-json) 正确拒。上游默认 `max_tokens` 截断曾致 game 类整份作废→`ivthtml.MAX_TOKENS=16384`。

## 测试基建
- 新套件须登记 `_run-tests.cjs`(要真 Chromium 标 needsBrowser)；runner 只认 `/通过 (\d+) 项，失败 (\d+) 项/`，只打 JSON 恒显示 0 通过⇒须补摘要行；反证套件摘要只写 `pass=N fail=M`。
- 行尾统一 LF(.gitattributes)；CRLF 让多行锚点恒 0 命中⇒反证集体假红。注释地雷：行注释 `/*` 吞整片代码。体检 `_eolguard`+`_eolguardneg`。
- 反证铁律：`from` 锚点须恰好命中 1 次(0=静默失效,≥2=假绿)；切片终点别用 `'}'`(块内`{...}`提前截断)，改定长窗口。

## 能力面 / 成长值 / 形态 / 朗读 / 缓存（要点）
- 能力面：拍照交卷三道闸、作业批改开放 API+`try.html`、家长免登录只读链接、卡片按知识点去重、朗读全链、判通过按得分率。
- 251 家长链接治理：停用权收归管理员(学生端 DELETE⇒403 ADMIN_ONLY)；`parent_tokens` 本无 expires 列⇒「永久有效」写进界面+回包 `permanent:true`。
- 成长值(pet.js)：唯一账本 `pet_events`；`pets.growth===SUM(delta)`；统一入口 `pet.onChatEvent(spaceId,userId,{kind,ref,score,examKind})`(①ref 幂等②日上限③判分服务端防刷)。不同激励家族须不同 kind+各自独立上限。
- 形态(structure.js)：靠提示词推不动⇒渲染层确定性兜底；五类 .md-pts/.md-egs/.md-key/.md-steps/.md-cmp；底线①只改呈现不改语义(字符无损)②不拆有风险内容③拆不出不拆。`stripTags` 会把裸 `$16<$` 当标签吃⇒恒等 render 须先转义实体再比对。
- 朗读/TTS：小米 MiMo 是第三协议(POST base/chat/completions,头 api-key,audio.format mp3,响应 choices[0].message.audio.data base64,必设 AbortSignal.timeout(120000))；Key 存 meta `tts:apiKey`；读用户看到的公式=渲染后 DOM innerText 非 markdown 源码；无流式⇒切句→并发2合成→按序串行播。
- 静态缓存：hl-platform `assetVersion()`(size+mtimeMs)给 js 追 `?v=`(只/js/；css 线上根级/app.css)；studymate Next build chunk 全换⇒归档 `_next/static`+nginx 直出。

## 代码易漏点（跨项目）
- 同文件并行多 Edit=last-writer-wins⇒批量替换用一次性脚本(读全文→全量 replace→写回)，提交前 diff。
- Bash cwd 会重置回项目根⇒每条 git 命令显式 cd。
- 遮挡/几何类只有真浏览器 `getBoundingClientRect` 判得出；跑法 `env -u NODE_OPTIONS -u CODEBUDDY_SAFE_DELETE_* NODE_PATH=<node workspace>/node_modules <managed node22> _bXXXbrowser.cjs`。
- hydration 前点击被丢⇒关键交互用原生 radio+`:has()` 纯 CSS。
- iOS 不认 SVG 当 apple icon(要 PNG 180×180)；服务器侧改文件 scp 拉→改→回传；起真服务验证 `NO_DOTENV=1 PORT=3199 DATA_DIR=<tmp> ADMIN_PASSWORD=xxx node server.js`→`POST /api/admin/login`→`POST /api/admin/spaces`→`POST /api/auth/login`。

## 其他产品线（要点）
- 报障工单(`server/bugreports.js`+`public/js/{bugreport,admbugs}.js`)：状态可见已实现；A2 剩「回复给学生看」+「管理端统计条」，note 一字段两用建议拆 `reply`。
- camp 麦克风国内必失败⇒注入 shim 切平台 ASR；管理端登录带验证码无法自动化。认证共 5 套。
- wrong-notebook(3002)：第三方 Next+Prisma+next-auth，非 git 仓库，改动须 docker compose build。videoclass(api 8021)：预览资产都要 Bearer，上游 401 不许透传 502。
- 洛谷 AI(oi.aijiangti.cn)：刷报告攻击已封；students/banned_at UTC、tasks GMT+8、nginx +0800。
- 教材 OCR：`extract.js` 抽文字层；`ocr.js` 三段式(AIMD 10RPM、页级断点续传)；插图交 MinerU(bbox 0~1000,>200页拆片 offset)；视觉 gemini-2.5-flash。

## 待拍板 / 遗留
- /ai 登录页站名是否换「爱讲题」（test/admin-and-tts.test.js:927 有断言依赖）。
- 报障工单 A2 的 `reply` 字段拆分口径。
- ~~StudyMate 仓大量 untracked(`_bXXX`/素材/方案 HTML)须归类~~ → **2026-10-28 已用 `.gitignore` 隔离**：`_bXXX`/`_cur`/`_chk`/`_fix`/`_shots`/`_home`/`_ig`/`_reg`/`_ref`/`_gesp`/`_msg`/`_probe`/`_pv`/`_mkjob`/`_t217`/`_uplim`/`.workbuddy-ai` 等 hl 调试杂物 + 嵌套第三方仓 `third-party/videoclass/` 全部忽略；`git status` 现仅剩交付文档。如需彻底清盘可后续把被忽略目录移出工作树归档（非删除）。
- 🔴 **`origin/main` 绝不是废弃旧线，禁止删除/强推覆盖！** 实测 `origin/main`(c7e1c5a) 领先 `master`(bfb52e5) 20+ 个提交（openmaic课件链路/作业通v0.1/rebrand to StudyMate/48秒生成 等都在它上面，`master` 一个都没有）。它是一条**活跃的并行开发分支**。若要整合须显式 merge，绝不能 `push --force` 或 `branch -D` 把它抹掉。记忆里曾记「2026-06-03 旧线考虑删除」是过时误判，以此条为准。
