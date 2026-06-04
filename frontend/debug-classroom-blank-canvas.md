# Debug Session: classroom-blank-canvas [OPEN]

## Symptoms
- 错题 classroom 首屏只有声音，主课件区域大面积白底，看不到课件元素
- 同一课堂数据存在，浏览器无障碍树里可见题目文本与课堂控件

## Reproduction
1. 打开 `http://localhost:3013/classroom/Ik62n0ETF5`
2. 等待加载完成并自动播放
3. 观察到有声音，但主舞台空白

## Hypotheses
1. `ScreenCanvas` 的 `canvasScale` / `viewportStyles` 被算坏，元素被缩没或偏出可视区
2. 白板或主视区容器被置于前台，顶替了正常课件区域
3. DOM 中已有课件元素，但被 overlay 遮挡
4. 课堂数据不是根因，渲染链路才是根因

## Evidence Plan
- 启动 7777 debug server，接住现有 instrumentation
- 复现 `Ik62n0ETF5`，读取 viewport / screen-canvas / canvas-visibility 事件
- 用日志判断是缩放、遮挡还是白板占位
