# Debug Session: same-tab-classroom

- Status: OPEN
- Symptom: 从 `/mistake` 生成后在当前标签页进入 `/classroom/[id]` 只看到错误壳层；复制同一个链接到新标签页后能看到真正课件。
- Expected: 当前标签页和新标签页都应直接看到同一份真实课件。

## Hypotheses

1. `classroom` 当前标签页进入时命中了错误的本地 store 状态，后续又被某个 effect 覆盖回“壳层态”。
2. `classroom` 当前标签页进入时先拿到了正确课堂，但随后某个恢复逻辑把 `currentSceneId`、`scenes` 或 `outlines` 重置成不完整状态。
3. `Stage` 组件或其依赖 store 在 client-side navigation 下存在旧课堂残留，而硬刷新会清空这部分内存。
4. 当前标签页进入时 `/api/classroom`、IndexedDB、内存态三者的命中顺序与新标签页不同，最终选中了错误数据源。
5. 问题不在数据加载，而在渲染层布局/可见性判断：当前标签页其实已经有真实课件，但被某个覆盖层重新遮住。

## Plan

1. 启动调试日志采集服务。
2. 只在 `classroom` 加载链路和舞台可见性关键点加插桩。
3. 复现“当前标签页异常 / 新标签页正常”两条路径。
4. 用日志排除假设后再做最小修复。

## Evidence

- `classroom`、`Stage`、`CanvasArea` 均已确认当前标签页拿到正确的 `stageId/currentSceneId`，且 `slide` 的 `canvas.elements` 非空。
- `ScreenCanvas` 日志显示异常复现时 `elementsLength` 为 16 或 17，但 `canvasScale` 会从正常值掉到 `0`。
- 直接读取持久化课堂文件 `data/classrooms/O1Ui5w2BTV.json` 可见首屏 `canvas.elements` 完整存在，排除“服务端课件为空”。

## Root Cause

- `useViewportSize()` 在某次同页跳转的布局抖动中读到了 `clientWidth/clientHeight = 0` 的容器尺寸，并把全局 `canvasScale` 写成了 `0`。
- 后续没有新的有效 resize 把它恢复，因此 `ScreenCanvas` 仍有元素，但最终被 `scale(0)` 缩没，只剩课件壳层背景。

## Fix

- 提取 `computeViewportPlacement()`，统一计算缩放和偏移。
- 当画布容器宽高、比例或计算得到的缩放值不合法时，直接跳过这次更新，保留上一份有效 `canvasScale`，避免被写成 `0`。
- 当前状态：代码修复完成，等待用户做 post-fix 复测。
