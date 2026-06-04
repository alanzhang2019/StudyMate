# Debug Session: classroom-needs-refresh [OPEN]

## Symptoms
- 从 `/mistake -> generation-preview -> /classroom/[id]` 自动跳转后，课件必须手动刷新一次网页才能看见。
- 预期：自动跳转到 `classroom` 后应直接看到首屏课件，不需要手动刷新。

## Reproduction
1. 打开 `/mistake`
2. 完成识别并进入 `generation-preview`
3. 等待自动跳转到 `/classroom/[id]`
4. 观察首屏是否仍停留在 loading/空白，且刷新后才恢复课件

## Hypotheses
1. `classroom/[id]` 自动跳转进入时，`loading` 解除条件晚于首屏 scene 恢复，导致首屏已可播放但 UI 仍被 loading 覆盖。
2. `generation-preview -> classroom` 的客户端跳转导致 `sessionStorage` / store 状态尚未稳定，`loadClassroom()` 首次读取到半完成状态，刷新后硬加载才恢复正常。
3. `loadFromStorage()`、server hydration、media/agent restore 三段异步任务存在竞态，首次进入时某个 Promise 延迟或报错阻塞了最终可见态。
4. 自动跳转链路与手动刷新链路命中了不同的 Next.js dev RSC/HMR 时序，首次进入时页面挂载或脚本更新打断了课堂首屏展示。

## Plan
1. 给 `classroom/[id]` 首次加载、loading 解除、自动跳转后首屏状态加最小日志。
2. 复现 `/mistake -> generation-preview -> classroom` 真实链路并抓运行态证据。
3. 根据日志确定阻塞点，再补最小修复和回归验证。
