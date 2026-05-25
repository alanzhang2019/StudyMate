# Debug Session: mistake-classroom-regression [OPEN]

## Symptoms
- 通过 `/mistake -> generation-preview -> /classroom/[id]` 得到的 classroom `O2VZ2JyyAD` 仍存在“最小化/退出全屏后课件看不见”的问题。
- 直接打开 `Ik62n0ETF5` 不存在同样问题。
- 预期：两条 classroom 都应在同标签页和多次最小化/退出全屏后稳定显示课件。

## Compared Cases
- Bad: `http://localhost:3013/classroom/O2VZ2JyyAD`
- Good: `http://localhost:3013/classroom/Ik62n0ETF5`

## Hypotheses
1. `O2VZ2JyyAD` 的首屏或后续 scene 数据结构与 `Ik62n0ETF5` 不同，导致展示态切换后命中了另一条渲染路径。
2. `/mistake -> generation-preview -> classroom` 链路把某个客户端状态写进了 `O2VZ2JyyAD` 对应会话，而直开 classroom 不会触发该污染。
3. `defaultPresentation` / `whiteboardOpen` 之外，还有 `canvasScale`、`zoomTarget`、`spotlight` 或 `currentSceneId` 在坏例子里被写坏。
4. `O2VZ2JyyAD` 生成完成时落盘的课堂快照本身就缺失某些首屏可视字段，导致最小化后恢复时只能命中坏快照。
5. 问题不在通用布局逻辑，而在 `O2VZ2JyyAD` 这类由真实 mistake 链路生成的 classroom 数据或恢复顺序。

## Plan
1. 对比两条 classroom 的服务端数据和客户端加载状态。
2. 复现坏例子的最小化/退出全屏问题，并抓浏览器运行态证据。
3. 用日志判断问题落在数据、恢复顺序还是可视状态污染。
4. 证据明确后，再补最小修复和回归验证。
