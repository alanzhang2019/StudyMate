# [OPEN] interactive-click-dead

## 症状
- 互动场景页面仍然无法交互，点击按钮/控件没有实际反应。
- 同时存在布局异常历史现象，但本轮优先确认“点击无效”的运行时根因。

## 现象与预期
- 实际：互动页面展示出来后，点击 `启动`、`重试` 等按钮无变化。
- 预期：按钮、滑块、输入控件应在 iframe 内触发实际状态变化或动画。

## 本轮假设
- H1: 正式播放页 iframe 实际加载内容不对，按钮所在页面并不是预期 interactive HTML。
- H2: 点击事件进入了 iframe，但 iframe 内脚本没有绑定成功，导致 UI 看起来可点但无 handler。
- H3: iframe 内部有透明遮罩、禁用层或 CSS `pointer-events` 配置错误，事件被拦截。
- H4: 互动页依赖 `postMessage` 或初始化脚本，但正式播放页未正确完成加载/初始化时序。
- H5: 当前展示的是 url 场景，但资源请求失败或沙箱权限不足，导致脚本未执行。

## 证据计划
- 在正式播放的 `InteractiveRenderer` 中记录 iframe source、load、focus、pointer 事件。
- 在 iframe 注入层记录文档 readyState、脚本数、交互元素数，并桥接 click/pointer/error 到父页面。
- 对比点击前后日志，判断事件丢失在“父容器 / iframe 边界 / iframe 内部脚本”哪一层。

## 状态
- instrumentation-round-1-complete

## 第一轮证据结论

| ID | 假设 | 状态 | 证据摘要 |
|----|------|------|----------|
| A | 正式播放页加载的不是预期 interactive HTML | ❌ 已排除 | 日志显示 `sourceType=srcDoc`，且文档标题为“工程工作量与时间关系”，脚本数 2、交互元素数 6，说明已加载到有效互动文档。 |
| B | 点击进入 iframe，但 iframe 内部脚本/handler 没真正绑定 | ⏳ 待确认 | 已观察到 iframe 内 `click` / `input` 事件，但还没拿到具体按钮属性、handler 和点击后的状态变化。 |
| C | 外层遮罩或 pointer-events 拦截事件 | ❌ 已排除 | 日志显示 iframe 内部已收到多次 `pointerdown`。 |
| D | iframe 初始化时序异常，展示时脚本未 ready | ⚠️ 部分排除 | 早期有 `readyState=loading`，但随后进入 `complete`，且仍然无法互动，说明单纯 load 时序不是最终根因。 |
| E | 资源失败或沙箱权限导致脚本根本没执行 | ❌ 暂未发现支持证据 | 当前没有抓到 iframe `error`，且脚本标签存在。 |

## 下一步
- 补充第二轮埋点：记录按钮/滑块的具体 DOM 属性、是否存在 `onclick` / disabled / data-action。
- 记录点击前后按钮文本、进度文本、状态区域文本是否变化。
- 若仍无变化，则定位到“生成出来的互动 HTML 本身缺少有效行为实现”。

## 第二至四轮证据结论

| ID | 假设 | 状态 | 证据摘要 |
|----|------|------|----------|
| A | 正式播放页加载的不是预期 interactive HTML | ❌ 已排除 | 多轮日志都显示 `sourceType=srcDoc`，文档标题与工程互动内容一致。 |
| B | iframe 内脚本没有完成有效控件绑定 | ✅ 已确认 | `mainBtn`、滑块都收到了真实 `click/input`，但点击前后状态文本完全不变；同时 `mainBtn` 无 `onclick`，也没有观察到针对目标控件的 `addEventListener` 注册。 |
| C | 外层遮罩或 pointer-events 拦截事件 | ❌ 已排除 | iframe 内部多次捕获到 `pointerdown`。 |
| D | 初始化时序导致脚本在 DOM 未就绪时执行 | ⚠️ 不是充分根因 | 已实施“可执行脚本移动到 `</body>` 前”的修复，但用户第四轮仍可复现，说明即使修正了部分时序问题，仍存在更底层的生命周期/渲染架构差异。 |
| E | 资源失败或脚本异常导致完全没执行 | ❌ 暂无支持证据 | 没有捕获到对应 runtime error，且互动文档能正常渲染。 |
| F | 当前项目的 iframe 生命周期与官方 OpenMAIC 不一致，导致 interactive document 在场景树内被重建/打断 | ✅ 新确认的主假设 | 官方实现使用 `InteractiveIframeHost` + `interactive-iframe-pool`，真实 iframe 常驻 `Stage` 根部保活；当前项目仍在 `InteractiveRenderer` 内直接创建 iframe，并叠加了大量临时注入补丁，和官方实现明显分叉。 |

## 已实施修复
- 在 [interactive-post-processor.ts](file:///D:/AItrade/AI-MATH-MISTAKE/lib/generation/interactive-post-processor.ts) 增加 `moveExecutableScriptsToEndOfBody()`。
- 逻辑为：保留 `widget-config` JSON 脚本不动，将其余可执行脚本统一移动到 `</body>` 前执行，确保 DOM 控件先就绪再绑定事件。

## 验证
- 新增回归测试 [interactive-post-processor.test.ts](file:///D:/AItrade/AI-MATH-MISTAKE/lib/generation/interactive-post-processor.test.ts)。
- 已验证测试从失败变为通过。

- 但用户第四轮仍反馈“已复现”，因此该修复只能说明它解决了一个局部问题，不是最终根因。

## 当前结论
- 现有“脚本顺序修复 + iframe 内临时 support/debug 注入”路线未解决根因。
- 官方 OpenMAIC 的关键差异不是 prompt，也不是重型 iframe patch，而是：
  - `patchHtmlForIframe()` 基本只做 CSS 补丁；
  - `InteractiveRenderer` 只是占位与量测；
  - 真实 iframe 常驻 `InteractiveIframeHost`，由 `interactive-iframe-pool` 保活与定位。
- 下一步应按官方架构把当前“场景内直渲 iframe”改为“稳定 host + keep-alive pool”，再做新一轮验证。
## 状态
- fix-implemented-awaiting-user-verification
- architecture-diff-confirmed-awaiting-implementation
