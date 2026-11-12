# 爱讲题 / hl-platform / StudyMate（红线索引）

> 批次流水见同目录 `2026-*.md`。**细目先读 `MEMORY-detail.md`**（教材/学习地图、ASR、互动课件、网关、成长值彩蛋、班级海、两棵左树、AI 海报、WNPAPER 拍卷全套）——不自动注入，动那些模块前必须 Read。
> 四线：StudyMate(`/`,master) · hl-platform(`/ai`) · wrong-notebook(`/wrong-notebook`) · videoclass(8021)。
> 本工作区＝仓 `alanzhang2019/StudyMate`；hl 代码在 `.workbuddy/wn-b206/hl-platform`。端口：hl 3100 / sm-front 3001 / backend 3000 / 错题本 3002。

## 🔴 部署（两条线最容易出错的地方）
- **hl-platform**：活文件＝容器跑的根 `/app/server.js`（`server/server.js` 是死副本）；改完 `docker exec hl-platform grep -n 'ASCII锚点' /app/server.js`（中文经 ssh 管道恒返 0＝假阴性）。部署＝commit→push→服务器 `git fetch`+`reset --hard origin/main`；动代码前先 `git fetch`+`merge --ff-only`（本地常落后）；Windows `core.autocrlf false`。只改 `public/js|css` 不重启（bind mount+`assetVersion()`），改 server → `docker restart`+`ps -o etime= -p 1`。写真库 `docker exec -e DB_FILE=/data/app.db`（不带＝空壳库）；`D.run(sql,...p)` 传数组＝单值绑定 ⇒ 静默失效。
- **wrong-notebook**：线上 `/home/ubuntu/wrong-notebook`，容器 3002→3000，`basePath=/wrong-notebook`；**代码烤进镜像** ⇒ 改页面必 `docker compose build`+`up -d`（≈2.5 分钟，成功出 `[build] exit=0`），只改文件＝线上毫无变化。非 git 部署：逐文件 `cat >` 上传（`tr -d '\r'`）。
- ★★★ **本地副本常比线上旧**（本仓 `third-party/wrong-notebook` 就缺 `tutor-chat.tsx`/`video-explain.tsx`）⇒ 改任何文件前先 `base64 -w0` 拉线上版比对，**绝不拿本地副本盖线上**（WNPAPER 踩过：盖掉 `types.ts` 后构建报「`answerTutorQuestionStream` 不存在」）。
- ★★★ **wrong-notebook 查/写真库：`docker exec [-i] wrong-notebook node` 不带 `-e DATABASE_URL`** —— compose 已注入 `file:/app/data/dev.db`（挂载 ./data）。手动 `-e DATABASE_URL=file:/app/prisma/dev.db` 写进镜像死库，症状＝「登录成功但 FK 违反／本子不存在」。容器内无 python3/better-sqlite3 ⇒ 用 `/app/node_modules/@prisma/client`；**没有 Notebook 模型**，一个本子＝一条 `Subject`。
- 长 build 用远端 `setsid nohup bash /tmp/x.sh >/tmp/x.log 2>&1 </dev/null &`（本地 `&` 会被 SIGTERM 连带远端）。容器里长套件 `| tail` 会挂住 ⇒ 容器内 `nohup` 落盘分次 `cat`；`sleep 120` 被 SIGTERM（~100s 上限）。
- 全量 `_run-tests.cjs --skip-browser` 在本沙箱非门槛（基线 ~95 失败、spawn EBUSY）；`_textbook*` 缺教材 PDF 不绿。跑全量前先停后台测试。

## ★★★ 判据 / 反证（跨模块通用）
- ★★★ **判据跟产品真实允许输入走，不跟实现走**（posterone1：单元一览放行单单元、`buildPosterScene` 卡 `cards.length<2`，判据把「1 张卡返空串」当契约守了两批，77 项全绿而功能坏）。同一输入问每一道校验。
- ★★★ **断言自己会写错**：先剥注释再 grep（注释写着「改之前是 `max-w-3xl`/`Math.random()`」不剥就整批红）；禁用否定前瞻 `:\s*(?!false)`（`\s*` 回溯成 0 空格 ⇒ 恒红），改成抓值逐个比。
- ★★★ 纯函数绿 ≠ 接线通：关键交互要**隔离库真 HTTP 端到端**，功能改造带真模型+真实输入；验收必须用线上真库**逐字**样本，不许「等价」简化题。
- ★★★「只替换某一段」的逻辑，判据落在「实际送出去了什么」（asrpolish `vBase` 漏赋值 ⇒ 整段送去纠错、显示一模一样、两套测试全绿）。
- ★★★「我改了、用户说没变」先分清「没生效」还是「走的是另一条路」（posterentry1：AI 海报两条轨、入口一在卡头一在 `.acts`）；长卡片会把 `.acts` 顶出视野 ⇒ 卡头要补入口。
- ★★★ 闸门写在「代码在字符串里」的产物上时 `\b` 全线失效（JSON 里换行是 `\`+`n`、`<textarea>` 里是 `&lt;`）⇒ 一律在还原后的 `codeText` 上判。
- ★★★ 同一容器坑会按卡片逐个复发（`.msg-att-illu{line-height:0}` 塌陷，只补掌握卡、预测卡漏 8 个月）⇒ 徽章/药丸类必须自声明 `line-height`；新增 `.art-*` 先照 `.art-mastery` 抄重置。
- ★★★「讲解成立」只能由本轮模型可见正文判定（`teachDelivered = 正文.trim().length>=20`），不能拿「教材摘到没有」当代理（gatefix1）。
- ★ 反证 `from` 必须恰好命中 1 次（0 次＝变异从未执行＝空转）；切片终点别用 `'}'`；松散 `indexOf` 被函数定义兜底＝假绿；基线+还原后必须全绿；`if (ONLY)` 判空数组＝真值 ⇒ 自检 `pass+fail===条数`。
- ★ `ok(name,cond,extra)` 里 `JSON.stringify(undefined)` 返 undefined ⇒ `.slice()` 炸整套；「红在别处：[]」多半是断言自己抛了。已落库附件不随提示词更新 ⇒ 改完提示词要重新生成那张卡。
- 「写了某条 CSS」≠「它赢」：只认真 Chromium 读 computed style / `getBoundingClientRect()` 前后差。真跑：`env -u NODE_OPTIONS -u CODEBUDDY_SAFE_DELETE_* NODE_PATH=<node ws>/node_modules <managed node22> _x.cjs`；本地查语法用 `@babel/parser`（plugins `jsx`+`typescript`）。新套件登记 `_run-tests.cjs`（真浏览器标 needsBrowser），只认 `/通过 (\d+) 项，失败 (\d+) 项/`，行尾 LF。

## 🔴 拍整张卷子（WNPAPER）—— 现在最容易被改坏的红线
- **只收题、不给答案**（防抄作业）：收「老师批错的」+「空白的」；无痕迹按模型自判但标「AI 判断，可能有误」，学生可取消勾选。
- 答案不外泄靠**结构性白名单**（`paper-rules.mjs` 逐字段重建，绝不 spread raw），提示词只是请求不是保证。
- ★★★ **光堵答案卡不算堵住**：详情页还有三条解题器 —— 问小老师（TutorChat 监听 `wn:tutor-open`）、视频讲解、GeoGebra 演示。对 `item.paperScanId` 的题必须**整块不挂载**（藏起来也会被唤起）。
- ★★★ **练习页是出变式题**（自带自己答案）⇒ 不能拿「练习页不给答案」当判据＝口径漂必假红；要守的是「**原题**答案不外泄」。
- 判据 `scripts/check-paper-scan.cjs` 46 条 + 反证 10/10 + 端到端 `_e2e.cjs` 22 项（细节见 detail 文）。
