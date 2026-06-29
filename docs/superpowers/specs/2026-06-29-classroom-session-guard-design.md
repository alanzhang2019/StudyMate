# Classroom Session Guard 设计

## 背景

Web 版本中，课件生成（`/generation-preview`）和课件播放（`/classroom/[id]`）存在两个用户体验问题：

1. **下拉刷新 / 关闭 tab / 浏览器返回**会意外中断任务，生成中的 SSE 连接被切断，播放进度丢失
2. **生成页已有 storage 持久化和服务端后台 job**，但前端没有任何 `beforeunload` 保护，也没有"返回时主动恢复"提示

目标：拦截意外导航，丢失后能优雅恢复。

## 方案选择

### 实现路径：单一 Hook + 独立 Banner（方案 A）

调用方一行 `usePromptLeaving(when)` 即可获得完整保护，Banner 组件复用、独立测试。

### 保护力度：原生浏览器提示

- 刷新 / 关闭 tab / 外部导航：浏览器原生 `confirm`
- 浏览器返回 / 程序化 `router.push`：通过 `pushState` 哨兵 + `popstate` 拦截，弹 `window.confirm`

### 范围：生成 + 播放都保护

- 生成：`previewPhase` 为 `generating-content` 或 `review` 时启用
- 播放：`currentSceneId != null` 且未结束时启用

### 返回体验：顶部提示条 + 手动选择

黄色 Alert 顶部条，按钮 `[继续] [丢弃]`，ESC = 丢弃。

## 架构

```
┌─────────────────────────────────────────────────────┐
│ Hook 层 (lib/hooks/use-prompt-leaving.ts)           │
│  ├─ beforeunload → 浏览器原生 confirm               │
│  ├─ pushState 哨兵 + popstate → window.confirm      │
│  └─ 卸载时清理所有监听                              │
└─────────────────────────────────────────────────────┘
                       ▲ usePromptLeaving(when, msg)
┌──────────────────────┴──────────────────────────────┐
│ 组件层 (components/common/resume-banner.tsx)        │
│  - 顶部 Alert，"上次的任务还在进行中..."             │
│  - [继续] [丢弃] 按钮                               │
└─────────────────────────────────────────────────────┘
                       ▲
┌──────────────────────┴──────────────────────────────┐
│ 页面集成                                            │
│  /generation-preview → usePromptLeaving(generating) │
│  /classroom/[id]     → usePromptLeaving(playing)    │
│  /mistake, /history  → <ResumeBanner/> 自动检测     │
└─────────────────────────────────────────────────────┘
```

## 存储层

### 生成会话（**复用现有** `generation-preview-storage.ts`）

- Key: `generationSession`
- 位置：sessionStorage + localStorage 双写
- 已有 `save/load/clear` 三函数，不动

### 播放进度（**新增** `playback-session-storage.ts`）

```ts
type PlaybackResumeState = {
  classroomId: string;
  sceneId: string;
  sceneIndex: number;
  isPlaying: boolean;
  savedAt: number;
};
```

- Key: `playbackSession`
- 位置：**sessionStorage**（关 tab 即清，避免幽灵恢复）
- API：`savePlaybackSession` / `loadPlaybackSession` / `clearPlaybackSession(classroomId?)`
- **24 小时过期**检测
- 存储被禁用时 try/catch 静默降级

## Hook 实现

```ts
function usePromptLeaving(when: boolean, options?: { message?: string }): void;
```

**三种保护**：

1. **`beforeunload`**：监听 `window.beforeunload`，`e.preventDefault()` + `e.returnValue = message`
2. **浏览器返回**：`history.pushState({ __promptGuard: true })` 插入哨兵，监听 `popstate`，取消时再次 push 哨兵，确认时移除监听并 `history.back()`
3. **BFCache 恢复**：监听 `pageshow` 事件，若 `event.persisted === true` 重新 pushState 哨兵

**安全守卫**：
- `typeof window !== 'undefined'` SSR 保护
- `useRef` 缓存 `when` 值避免闭包过期
- unmount 显式 `removeEventListener` + 清哨兵

## ResumeBanner 组件

```tsx
type ResumeBannerProps = {
  variant: 'generation' | 'playback';
  state?: PlaybackResumeState;          // playback 模式必传
  onResume: () => void;
  onDiscard: () => void;
};
```

- shadcn `<Alert>` + 黄色 variant（`bg-amber-50 border-amber-200`）
- `'use client'` + `useEffect(() => setMounted(true), [])` 避免 hydration mismatch
- 过期（>24h）不显示
- ESC 键 = 丢弃

## 页面集成

| 页面 | Hook `when` | Banner `variant` | 写入 |
|---|---|---|---|
| `/generation-preview` | `previewPhase ∈ {generating-content, review}` | — | 现有 `saveGenerationPreviewSession` |
| `/classroom/[id]` | `currentSceneId != null && !isAtEnd` | `playback` | 节流 500ms `savePlaybackSession` |
| `/mistake`（首页） | — | `generation` | — |

**写入节流**：canvas-area 监听 `currentScene` 变化，500ms 内合并多次写入为一次 `setItem`。

## 错误处理

| 场景 | 处理 |
|---|---|
| SSR 报 `window is not defined` | `typeof window` 守卫 + `mounted` 状态延迟渲染 |
| localStorage 禁用 / quota 满 | try/catch + console.warn，UI 降级为不保存 |
| popstate 死循环 | 哨兵唯一标识 `{ __promptGuard: true }`，仅在 `!e.state?.__promptGuard` 时弹 confirm |
| 事件监听未清理 | cleanup 显式 removeEventListener，ref.current = false |
| session > 24h | 过期检查，返回 null，banner 不显示 |
| 服务端 job 已失败 | `/generation-preview` mount 时 fetch `GET /api/generate-classroom/[jobId]`，若 `status === failed` 切到 error phase |
| 多 tab 同步 | `storage` 事件 + `BroadcastChannel('playback')`，单 tab 降级即可 |
| iOS Safari popstate 不可靠 | 双 pushState 保险 |
| quiz / interactive 中间态 | `savePlaybackSession` 仅在 `sceneType === 'slide'` 时调用 |

## 测试

### 新增 `tests/hooks/use-prompt-leaving.test.ts`（8 case）

- when=false 不挂监听
- when=true 挂 beforeunload + popstate
- 卸载时移除监听
- 触发 beforeunload 后 e.returnValue === message
- popstate 取消 → 再次 pushState
- popstate 确认 → history.back()
- SSR 环境不抛错
- BFCache 恢复（mock pageshow）

### 新增 `tests/mistake/playback-session-storage.test.ts`（6 case）

- save/load 往返一致
- clear 不传参清所有
- clear 传 classroomId 只清该课件
- 过期（>24h）返回 null
- 存储被禁用时不抛错
- JSON parse 失败返回 null

### 手动验证

- [ ] 生成页 F5 → 弹原生 confirm
- [ ] 生成中关 tab，重新打开首页 → 顶部 banner
- [ ] Banner 继续 → 回到原进度
- [ ] Banner 丢弃 → 清空 storage
- [ ] 播放页浏览器返回 → 弹原生 confirm
- [ ] 播放页 F5 确认后 → 重新进入跳到上次 scene
- [ ] 移动端 Safari 下拉刷新 → 弹原生 confirm
- [ ] 隐私模式 → 不报错，banner 不可用

## 新增 / 修改文件

**新增（4 个）**：
- `frontend/lib/hooks/use-prompt-leaving.ts`
- `frontend/components/common/resume-banner.tsx`
- `frontend/lib/mistake/ui/playback-session-storage.ts`
- `frontend/tests/hooks/use-prompt-leaving.test.ts`
- `frontend/tests/mistake/playback-session-storage.test.ts`

**修改（3 个）**：
- `frontend/components/canvas/canvas-area.tsx` — scene 变化节流写入
- `frontend/app/generation-preview/page.tsx` — usePromptLeaving
- `frontend/app/classroom/[id]/page.tsx` — usePromptLeaving + ResumeBanner 挂载
- `frontend/app/mistake/page.tsx` — ResumeBanner 挂载
