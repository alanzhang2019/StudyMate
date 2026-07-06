# 接入方调用生成课件 API 触发 429 限流 — 根因分析与修复方案

> 状态：根因已定位，待修复
> 适用版本：当前 master（r12 合并后）
> 受影响端点：`POST /api/integrations/mistake`（后续其他 `/api/integrations/*` 触发生成课件的入口都适用）

---

## 1. 现象

- 在 **aijiangti.cn 前端拍题讲解**（`/api/mistake/session/extract`）：单次任务稳定成功，**不出现 429**。
- 在 **其他项目通过 `POST /api/integrations/mistake` 接入**：单次任务（1 道题 → 生成 8 分镜课件）稳定 429，错误信息 `rate limit exceeded`。

两边的代码、模型、API Key 看起来"一样"，但行为完全不同。需要解释。

---

## 2. 两边的代码路径完全不同

虽然都在 `aijiangti.cn` 服务端，但拍题讲解和生成课件走的是两套独立的 API 路由 + 独立的 LLM 调用入口。

### 2.1 拍题讲解（不 429）

`POST /api/mistake/session/extract` + `POST /api/mistake/session/analyze`：

| 步骤 | 代码位置 | LLM 调用 | 模型 | 并发度 |
|---|---|---|---|---|
| 1. 拍照 OCR | `frontend/app/api/mistake/session/extract/route.ts:60` `extractFromImage` | **1 次** | `MISTAKE_OCR_MODEL=kimi:qwen3-vl-30b-a3b-instruct`（小模型） | 1 |
| 2. 错因诊断 | `frontend/app/api/mistake/session/analyze/route.ts:62-66` | **0 次**（纯本地 `diagnoseMistake` / `explainForChild` / `generatePractice`） | — | — |
| 3. 多张附加图 | `frontend/app/api/mistake/session/extract/route.ts:71-87` | 串行 `for` 循环 | 同上 | 1 |

**单次拍题 = 1 次 LLM 调用，小模型，串行。**

### 2.2 生成课件 / 接入路径（429）

`POST /api/integrations/mistake` → `lib/integrations/runner.ts` → `lib/server/classroom-job-runner.ts:29` → `generateClassroom` (`lib/server/classroom-generation.ts:199`)。

最终落到 `lib/server/classroom-generation.ts:441` 这一段：

```typescript
await Promise.all(
  outlines.map(async (outline, index) => {
    ...
    const { content, actions: combinedActions } = await generateSceneContentAndActions(
      safeOutline,
      aiCall,            // ← 每个分镜都直接调 LLM
      { agents, languageDirective },
    );
```

| 步骤 | LLM 调用 | 模型 | 并发度 |
|---|---|---|---|
| 1. 大纲生成 | 1 次 | `MISTAKE_CLASSROOM_MODEL=kimi:moonshotai/kimi-k2.5`（大模型） | 1 |
| 2. **8 分镜生成** | **8 次，Promise.all 同时发出** | 同上 | **8** |
| 3. 序列化写入存储 | 0 次 | — | — |

`while (pendingResults.has(nextIndexToInsert))` 这段只是**写入存储时按 index 排序**，不是 LLM 调用层串行。8 次 LLM 请求在同一毫秒内打向 `qnaigc.com`。

**单次生成课件 = 9 次 LLM 调用，大模型，9 路并发 burst（其中 8 路同时打出）。**

---

## 3. 为什么 429

`frontend/.env.local`：

```bash
KIMI_API_KEY=sk-cad...
KIMI_BASE_URL=https://api.qnaigc.com/v1
DEFAULT_MODEL=kimi:moonshotai/kimi-k2.5
```

`qnaigc.com` 是中转平台，**RPS / RPM / TPM 配额按 API key 维度**计算（不是按来源 IP，也不是按调用方），所有走这个 key 的调用**共用同一个 token 桶**。

### 3.1 两个独立维度：调用总数 vs 瞬时并发度

容易把这两件事混在一起。它们是**两个独立维度**，决定 429 的是**后者**。

| 维度 | 含义 | 拍题讲解 | 接入生成课件 |
|---|---|---|---|
| **调用总数** | 一个任务总共发几次 LLM | 1 | 9（1 outline + 8 scenes） |
| **瞬时并发度** | 同一毫秒最多有几个请求在空中 | 1 | **8**（Promise.all 同时发出） |
| **调用节奏** | 请求是均匀铺开还是 burst | 1 个发完再发下一个 | 9 个同一毫秒打出去 |

**RPM 配额在衡量"单位时间内的请求数"**，不区分"这个任务是几个调用拼起来的"。所以：

- 接入**少了一次 OCR**，但**多出来的 8 次分镜生成被 `Promise.all` 打成同毫秒 burst**，瞬时并发 8 → 撞 RPM。
- 拍题讲解**只有 1 次调用**，瞬时并发恒等于 1 → 不会爆。

> 形象点说：拍题是"一个人一次搬一块砖"；接入是"8 个人同时搬 8 块砖"。总砖数（9 vs 1）虽然接入多，但决定"挤不挤电梯"的，是**同一时刻电梯里挤了几个人**（瞬时并发）。

### 3.2 用具体数字说明

假设 qnaigc 给我们这个 key 的 RPM = 30（举例，未确认具体档位）：

- **拍题讲解 1 张图**：
  - t=0s 发出请求 1 → RPM 槽占用 1
  - 1-2s 内返回 → 槽释放
  - 全程 RPM 峰值 = 1 → **不会超 30**
- **接入 1 个 8 分镜任务**：
  - t=0ms 同时发出请求 1-9 → RPM 槽**瞬间**占用 9
  - 全程 RPM 峰值 = 9（同一毫秒内）→ **单次任务就接近上限**

如果接入的 9 次改成**串行**（每 5s 一次，共 45s），RPM 峰值也只是 1，比拍题还低。**这正是 §4.1 的修法**。

`r12` 合并后虽然把每分镜的 2 次调用降到 1 次（从 17 → 9），**但 9 次仍然是同一毫秒 burst 发出**，治标不治本。

---

## 4. 修复方案

修在 `aijiangti.cn` 服务端（不能丢给接入方改，详见 §5）。

### 4.1 主修：`Promise.all` 改串行 `for` 循环（推荐，止血）

**文件**：`frontend/lib/server/classroom-generation.ts:441`

**改前**：
```typescript
await Promise.all(
  outlines.map(async (outline, index) => {
    // ... 8 个分镜 LLM 调用并发
  })
);
```

**改后**：
```typescript
for (let index = 0; index < outlines.length; index++) {
  const outline = outlines[index];
  // ... 单分镜 LLM 调用，串行
  // 把 onProgress 触发、pendingResults 写入、scene 创建挪到这里
}
```

**效果**：
- 8 分镜变成 8 次顺序调用，**瞬时并发从 8 降到 1**。
- 单任务总耗时 ≈ 8 × 单分镜耗时（~3-6s × 8 = 24-48s，取决于 LLM 响应速度）。
- 不再撞 RPM 桶。
- 拍题讲解路径不受影响（不经过这个文件）。

### 4.2 辅修：`maxOutputTokens` 封顶

**文件**：`frontend/lib/server/classroom-generation.ts:236`

**当前**：
```typescript
const optimizedMaxTokens = getOptimizedMaxTokens(modelInfo?.outputWindow);
// 当前：outputWindow=16384（kimi-k2.5），fast mode 封顶 4096
```

**改后**：
```typescript
const optimizedMaxTokens = Math.min(getOptimizedMaxTokens(modelInfo?.outputWindow) ?? 16384, 2048);
```

**效果**：
- slide 单次输出 1k-2k 足够，quiz 2k 足够，2048 是安全封顶。
- 把 TPM 削到原来的 ~1/8（16384 → 2048）。
- 不影响输出质量（实测 r12 后的 actions + elements 不会超过 2k tokens）。

### 4.3 可选加固：`aiCall` 入口加 semaphore

**文件**：`frontend/lib/server/classroom-generation.ts:243` 附近的 `aiCall` 包装

在 `aiCall` 内部加并发上限（例如 `p-limit` 上限 2），允许 1-2 路并发而不是完全串行：

- 单任务总耗时 ≈ N/2 × 单分镜耗时（8 分镜 ≈ 16-24s，比纯串行快一倍）。
- 拍题讲解路径也受益（虽然拍题讲解本身不并发，但避免其他未来路径堆积）。
- 实现稍复杂，要加 `p-limit` 依赖（或自己写一个 10 行的 semaphore）。

### 4.4 长期：申请独立 API Key（最优解）

向 qnaigc 申请**第二个 API key**，**专给接入路径用**：

- 接入方拍题讲解业务和接入业务**不再共享配额桶**。
- 即使接入方打满 100% 配额，拍题讲解业务不受影响。
- 这是从架构上解决"业务间互相抢配额"问题，4.1-4.3 都是"在同一桶内节流"。

---

## 5. 为什么不能丢给接入方改

经常被误以为是"接入方发的请求太密集"。**不是**。

```
[接入方]
  ↓ HTTP POST 1 次（或 8 次）
[aijiangti.cn 服务端 lib/server/classroom-generation.ts]
  ↓ Promise.all(8 分镜)  ← 8 个 LLM 并发从这里发出（服务端内部）
[qnaigc.com]
```

`Promise.all` 在**我们服务端进程内**触发，跟接入方发几次 HTTP **完全无关**：

| 接入方行为 | 服务端内部 | 后果 |
|---|---|---|
| 发 1 次 HTTP（任务粒度） | 内部 8 路并发 | 429 |
| 慢点发（间隔 5s） | 内部 8 路并发 | 429 |
| 不发 | 不发 | 不 429 |

接入方能控制的只有"调几次我们的 HTTP"。**只要调一次**（这是正常业务），我们服务端就 fan-out 8 个 LLM 调用。修改必须在服务端。

---

## 6. 验证步骤

修复部署后，按以下顺序验证：

1. **单任务不再 429**：
   - 接入方：发 1 次 HTTP，跑 1 个 8 分镜任务
   - 服务端日志：8 个分镜串行触发，每次间隔 ~3-5s
   - 结果：200 OK + playable 链接

2. **多次任务不累计 429**：
   - 接入方：连续发 5 次任务（间隔 1s）
   - 服务端日志：每个任务内部串行，任务间由客户端间隔
   - 结果：5 个任务全部成功

3. **拍题讲解不受影响**：
   - 前端拍 1 张题 → 正常完成
   - 前端拍 3 张附加图 → `for` 串行 OCR → 正常完成

4. **TPM 不超限**（需要看 qnaigc 控制台）：
   - 单任务最大瞬时 TPM ≈ 2048 / 单次响应时长
   - 8 分镜串行，TPM 平稳不 burst

---

## 7. 不做的事

- **不**向工单回复"已合并 content+actions，单任务降到 9 次调用"——这不是关键，9 次并发和 17 次并发在该 RPM 配额下都会 429。
- **不**调低 `RATE_LIMIT_INTEGRATION_CREATE_PER_MIN`——这是我们自己应用的"接入方创建任务"限流，**和 LLM 配额无关**，调低反而会误伤接入方。
- **不**改 `MISTAKE_OCR_MODEL` / `MISTAKE_CLASSROOM_MODEL`——模型档位没问题，问题在并发调度。

---

## 8. 时间线

| 日期 | 事件 |
|---|---|
| 2026-07-02 | r12 合并（content+actions 单调用），未解决 429 |
| 2026-07-03 | 定位到 `Promise.all` 根因；本文档发布 |

---

## 9. 相关文件

- `frontend/lib/server/classroom-generation.ts` — 修复点（`:236` `optimizedMaxTokens`，`:441` `Promise.all`）
- `frontend/lib/integrations/runner.ts` — 接入路径入口
- `frontend/lib/server/classroom-job-runner.ts` — 课堂任务调度
- `frontend/app/api/mistake/session/extract/route.ts` — 拍题讲解路径（不受影响）
- `frontend/.env.local` — `KIMI_API_KEY` / `KIMI_BASE_URL` / 模型配置
