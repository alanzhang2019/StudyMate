# 第三方题目接入 / C++ 学科支持 设计文档

- 日期：2026-07-02
- 状态：已批准（用户同意）
- 范围：MVP，单实例 Next.js，无新账号体系

## 1. 背景与目标

Vjudge-AI-report 等第三方系统已经能针对 C++ 信息学题目完成 OJ 抓题、源码错因分析、知识点归类（GESP / NOI）。本项目（小
学 4-6 年级数学错题讲解机）希望对外暴露一个 **最小可程序化调用** 的接口：

- 第三方把一道 C++ 题目（含 verdict、题意、可选题型）POST 给本项目；
- 本项目在内部创建 mistake session、跑 C++ 启发式诊断、准备好 `generation-preview` 所需的 session 状态；
- 第三方在用户端把用户重定向到 `/generation-preview?session=…`；
- 用户在原生 UI 中观看 LLM 大纲、互动课堂。

最终交付物：两段 REST 接口（创建任务 + 查询任务）+ 扩展 `subject: 'math' | 'cpp'` + 扩展 diagnose 与 taxonomy。

## 2. 非目标（YAGNI）

- 不读学生 C++ 源码（用户决策）。
- 不引入 OAuth / 第三方账号绑定。
- 不提供 Webhook 回调（轮询已够用）。
- 不引入 BullMQ / Redis 等 worker 基础设施（单进程 in-flight job，已知限制）。
- 不支持数学 / C++ 之外的学科（接口 schema 留扩展位）。
- 不改动 Prisma schema（继续用 `frontend/lib/db.ts` 的 better-sqlite3 模式）。

## 3. 架构

```
第三方 (Vjudge)        本项目 (Next.js)
  │                        │
  │  POST /api/integrations/mistake
  ├──────────────────────►│ ① zod 校验
  │                        │ ② 限流（IP 维度）
  │                        │ ③ 写 integration_jobs（status=queued）
  │                        │ ④ 立即返回 { jobId, statusUrl }
  │                        │ ⑤ fire-and-forget runIntegrationJob(jobId)
  │                        │   ├─ createMistakeSession(subject='cpp', source='integration')
  │                        │   ├─ diagnoseCpp(input)
  │                        │   ├─ 写 session 状态 ready_to_generate
  │                        │   └─ 更新 job status=ready
  ◄──────────────────────┤
  │                        │
  │  GET /api/integrations/jobs/{id}
  ├──────────────────────►│
  ◄──────────────────────┤ 200 { status, sessionId, generationUrl, classroomUrl? }
  │                        │
  │  浏览器跳 generationUrl
  ├──────────────────────►│ /generation-preview?session=…&from=integration
  │                        │   - 复用 generation-preview 原生 UI
  │                        │   - from=integration 走 cpp prompt
  │                        │
  │  /api/generate/*       │ - 大纲/场景/媒体（不动）
  │  /classroom/[id]       │ - 课堂（不动）
```

## 4. API 表面

### 4.1 `POST /api/integrations/mistake`

请求（`Content-Type: application/json`）：

```json
{
  "subject": "cpp",
  "grade": 8,
  "verdict": "WA",
  "problemText": "给定一个长度为 n 的数组…",
  "studentAnswer": "（可选）",
  "correctAnswer": "（可选）",
  "problemType": "dp",
  "title": "洛谷 P1001",
  "source": "vjudge-ai-report"
}
```

字段约束（zod）：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `subject` | enum | 是 | MVP 仅 `cpp` |
| `grade` | int | 是 | 1..12 |
| `verdict` | enum | 是 | `AC` \| `WA` \| `TLE` \| `RE` \| `CE` \| `MLE` \| `PE` |
| `problemText` | string | 是 | 1..8000 chars（截断留扩展） |
| `studentAnswer` | string | 否 | <= 4000 chars |
| `correctAnswer` | string | 否 | <= 4000 chars |
| `problemType` | enum | 否 | `dp` \| `greedy` \| `brute` \| `graph` \| `string` \| `math` \| `other` |
| `title` | string | 否 | <= 200 chars |
| `source` | string | 否 | <= 64 chars |

响应：

| 状态 | 含义 | 响应体 |
|---|---|---|
| 201 | 成功 | `{ jobId, status: "queued", statusUrl: "/api/integrations/jobs/{id}" }` |
| 400 | 校验失败 | `{ error: "INVALID_REQUEST", issues: ZodIssue[] }` |
| 413 | 题目过长 | `{ error: "PROBLEM_TOO_LONG" }` |
| 429 | 限流 | `{ error: "RATE_LIMITED", retryAfter: number }` |
| 500 | 内部错误 | `{ error: "INTERNAL" }` |

### 4.2 `GET /api/integrations/jobs/{jobId}`

响应（200）：

```json
{
  "jobId": "ij_abc123",
  "status": "queued|running|ready|failed",
  "stage": "diagnosing | null",
  "sessionId": "ms_xyz",
  "generationUrl": "/generation-preview?session=ms_xyz&from=integration",
  "classroomUrl": null,
  "error": null,
  "createdAt": "2026-07-02T…",
  "updatedAt": "2026-07-02T…"
}
```

- 404：`{ error: "JOB_NOT_FOUND" }`
- 410：超过 TTL（24h）的 job 返回 `{ error: "JOB_EXPIRED" }`

### 4.3 `GET /api/integrations/health`

200：

```json
{
  "status": "ok",
  "subjects": ["math", "cpp"],
  "rateLimits": {
    "createPerMin": 10,
    "pollPerMin": 120
  }
}
```

## 5. 数据模型

新增表（写入 `frontend/lib/db.ts` 的 `_db.exec` 块）：

```sql
CREATE TABLE IF NOT EXISTS integration_jobs (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  source TEXT,
  request_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT,
  session_id TEXT,
  classroom_id TEXT,
  error_code TEXT,
  error_message TEXT,
  ip TEXT,
  ua TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_ip_time
  ON integration_jobs (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_status
  ON integration_jobs (status, created_at DESC);
```

TTL：`created_at + 24h`。

## 6. 类型与领域扩展

### 6.1 `frontend/lib/mistake/domain/types.ts`

```ts
export type InputSource = "photo" | "manual" | "integration";

export type MathMistakeCode =
  | "carry_mistake" | "borrow_mistake" | "operator_confusion"
  | "bracket_order_error" | "unit_conversion_error" | "concept_gap";

export type CppMistakeCode =
  | "compile_error" | "wrong_answer" | "runtime_error"
  | "time_limit" | "memory_limit" | "output_format" | "concept_gap";

export type MistakeCode = MathMistakeCode | CppMistakeCode;

export type Subject = "math" | "cpp";

export interface ProblemInput {
  grade: number;
  subject: Subject;
  source: InputSource;
  problemText: string;
  studentAnswer?: string;
  correctAnswer?: string;
  // cpp 扩展：
  verdict?: "AC" | "WA" | "TLE" | "RE" | "CE" | "MLE" | "PE";
  problemType?: "dp" | "greedy" | "brute" | "graph" | "string" | "math" | "other";
  title?: string;
}
```

### 6.2 diagnose adapter

`frontend/lib/mistake/diagnosis/diagnose.ts` 改为：

```ts
export function diagnoseMistake(input: ProblemInput): DiagnosisSummary {
  return input.subject === "cpp"
    ? diagnoseCpp(input)
    : diagnoseMath(input);
}
```

`diagnoseMath` = 原 `diagnoseMistake` 主体逻辑。
`diagnoseCpp` 规则（MVP）：

| 优先级 | 触发 | 标签 | confidence |
|---|---|---|---|
| 1 | `verdict === 'CE'` | `compile_error` | 0.95 |
| 2 | `verdict === 'TLE'` 或文本含 "超时/复杂度过高" | `time_limit` | 0.85 |
| 3 | `verdict === 'MLE'` 或文本含 "内存超/数组过大" | `memory_limit` | 0.85 |
| 4 | `verdict === 'RE'` 或文本含 "段错误/越界/除零/爆栈" | `runtime_error` | 0.85 |
| 5 | `verdict === 'PE'` 或文本含 "输出格式/换行/空格" | `output_format` | 0.8 |
| 6 | `verdict === 'WA'` 且 `problemType === 'dp'` | `concept_gap` | 0.65 |
| 7 | `verdict === 'WA'` | `wrong_answer` | 0.7 |
| 8 | `verdict === 'AC'` | `concept_gap` | 0.4（提交对了仍进来：用户主动复习） |
| 9 | 默认 | `concept_gap` | 0.5 |

### 6.3 taxonomy

- `frontend/lib/mistake/taxonomy/mistake-taxonomy.ts` → 拆为：
  - `frontend/lib/mistake/taxonomy/math-taxonomy.ts`（原内容）
  - `frontend/lib/mistake/taxonomy/cpp-taxonomy.ts`（新）
  - `frontend/lib/mistake/taxonomy/index.ts`：`getMistakeLabel(code)` 按 code 在两表里查，未命中抛 `UNKNOWN_MISTAKE_CODE`。

### 6.4 explain / practice

- `explain.ts` 拆为 `math-explain.ts` / `cpp-explain.ts`，由 `generation-preview` 阶段根据 `session.subject` 选。
- `practice.ts` 同上。
- 现有 `explainForChild(code)` API 保留兼容签名（dispatcher）。

### 6.5 session schema 扩展

`MistakeSession` 与 `CreateMistakeSessionInput`（[session/types.ts](file:///d:/AItrade/ai-math-mistake-machine/frontend/lib/mistake/session/types.ts)）需扩展：

- `subject?: 'math' | 'cpp'`
- `source: 'photo' | 'upload' | 'integration'`

store 层 [`session/store.ts`](file:///d:/AItrade/ai-math-mistake-machine/frontend/lib/mistake/session/store.ts) 透传 subject，不做特殊处理。

## 7. generation-preview 行为变化

`frontend/app/generation-preview/page.tsx` 在加载 session 时多读 `session.subject`：

- `subject === 'cpp'` → 注入 `from=integration` 来源 + 选 cpp prompt 模板
- `subject === 'math'` → 与现状一致，零行为变化

`buildMistakeClassroomRequirement`（[build-requirement.ts](file:///d:/AItrade/ai-math-mistake-machine/frontend/lib/mistake/openmaic/build-requirement.ts)）扩
展 subject 维度。

`persistPlayableClassroom` 不变。

## 8. 后台 Job 执行

`frontend/lib/integrations/runner.ts`：

```ts
export async function runIntegrationJob(jobId: string): Promise<void> {
  // 1. 读 job；status=queued 才继续，否则直接 return
  // 2. status -> running；stage=diagnosing
  // 3. createMistakeSession({ subject: 'cpp', source: 'integration', ... })
  //    - 不传 studentProfileId
  //    - ocr.confidence = 1.0
  //    - status: ready_to_generate
  // 4. 更新 job: sessionId, status=ready
  // 5. catch: status=failed, error_code/error_message
}
```

调用方：route handler 在写库后 `void runIntegrationJob(jobId).catch(...)`。

**已知限制**：Next.js 单进程；若进程重启 in-flight job 卡在 `running`。提供 `POST /api/integrations/jobs/{id}/retry` 端点补救（管理员友好，文档中标注）。

## 9. 限流

`frontend/lib/integrations/rate-limit.ts`：

- 内存 LRU + 滑动窗口。
- 配额：
  - 创建：`RATE_LIMIT_INTEGRATION_CREATE_PER_MIN` 默认 `10`
  - 查询：`RATE_LIMIT_INTEGRATION_POLL_PER_MIN` 默认 `120`
- IP 取 `x-forwarded-for` 第一个值；缺失则 `'unknown'`。
- 命中：throw `RateLimitedError`，handler 转 429 + `Retry-After`。

## 10. 路由实现

- `frontend/app/api/integrations/mistake/route.ts`
- `frontend/app/api/integrations/jobs/[id]/route.ts`
- `frontend/app/api/integrations/jobs/[id]/retry/route.ts`
- `frontend/app/api/integrations/health/route.ts`

handler 风格：复用 `apiError` / `apiSuccess`（[api-response.ts](file:///d:/AItrade/ai-math-mistake-machine/frontend/lib/server/api-response.ts)），zod 校验，复用
`trackEvent`。

## 11. 安全

- 拒绝非 `Content-Type: application/json` 的 POST。
- 题目文本 <= 8000 chars；超长拒绝 413。
- 记录 `ip`、`ua`、`source`、原始 `request_payload` 到 `integration_jobs`。
- 不在 `GET /jobs/{id}` 响应中回显 `request_payload`。
- `usage_events` 复用 `trackEvent('integration.mistake.create', { jobId, subject, ip })`。

## 12. 测试

- 单元：
  - `frontend/lib/integrations/schemas.test.ts`：zod schema 边界。
  - `frontend/lib/integrations/rate-limit.test.ts`：滑动窗口。
  - `frontend/lib/mistake/diagnosis/diagnose-cpp.test.ts`：9 个 verdict 分支。
  - `frontend/lib/mistake/taxonomy/cpp-taxonomy.test.ts`：标签完整性。
- 路由：
  - `frontend/app/api/integrations/mistake/route.test.ts`：201 / 400 / 413 / 429。
  - `frontend/app/api/integrations/jobs/[id]/route.test.ts`：状态机。
  - `frontend/app/api/integrations/health/route.test.ts`：smoke。
- 集成（手动）：
  - curl 创建 job → 轮询至 ready → 拿 generationUrl → 在浏览器打开 → 应跳到 generation-preview。

## 13. 文件清单

新增：

```
frontend/lib/integrations/
  schemas.ts
  rate-limit.ts
  runner.ts
  store.ts        # integration_jobs CRUD

frontend/lib/mistake/taxonomy/
  cpp-taxonomy.ts
  index.ts        # 统一导出
  math-taxonomy.ts (原 mistake-taxonomy.ts 改名)

frontend/lib/mistake/diagnosis/
  diagnose-cpp.ts
  diagnose-math.ts (原 diagnose.ts 拆出)
  index.ts        # dispatch by subject

frontend/lib/mistake/explain/
  math-explain.ts (原 explain.ts 拆出)
  cpp-explain.ts
  index.ts

frontend/lib/mistake/practice/
  math-practice.ts (原 generate-practice.ts 拆出)
  cpp-practice.ts
  index.ts

frontend/app/api/integrations/
  mistake/route.ts
  jobs/[id]/route.ts
  jobs/[id]/retry/route.ts
  health/route.ts

frontend/lib/integrations/__tests__/
  schemas.test.ts
  rate-limit.test.ts
  diagnose-cpp.test.ts
  cpp-taxonomy.test.ts
  mistake-route.test.ts
  jobs-route.test.ts
```

修改：

```
frontend/lib/mistake/domain/types.ts                  # +Subject, +CppMistakeCode, +verdict
frontend/lib/mistake/session/types.ts                 # +subject, +source='integration'
frontend/lib/db.ts                                    # +integration_jobs 表
frontend/app/mistake/page.tsx (可能的 source enum 导入)
frontend/app/api/mistake/session/route.ts             # subject 放宽到 'math'|'cpp'
frontend/app/api/mistake/session/analyze/route.ts     # 同上
frontend/lib/mistake/session/store.ts                 # 允许 subject=cpp 的 session 落库
frontend/lib/mistake/openmaic/build-requirement.ts    # subject 维度
frontend/lib/mistake/openmaic/types.ts                # MistakeClassroomInput.subject 扩
frontend/app/generation-preview/page.tsx              # 选 prompt 模板
```

## 14. 接入示例

第三方（Vjudge 端）：

```bash
curl -X POST https://<host>/api/integrations/mistake \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "cpp",
    "grade": 8,
    "verdict": "WA",
    "problemText": "给定一个长度为 n 的数组，求最大子段和…",
    "problemType": "dp",
    "title": "P1115",
    "source": "vjudge-ai-report"
  }'
# → 201 { jobId, status: "queued", statusUrl }

# 轮询
curl https://<host>/api/integrations/jobs/<jobId>
# → { status: "ready", sessionId, generationUrl }

# 浏览器跳转 generationUrl → 用户看 generation-preview → 完成后 /classroom/[id]
```

## 15. 已知限制

- 单进程 in-flight job 可能在重启时丢失；需 `POST /jobs/{id}/retry`。
- 内存限流在多实例下不共享（一致性：MVP 接受）。
- C++ 启发式诊断不读源码；只基于 verdict + 题意 + problemType。
- 没做 callback webhook；轮询间隔建议 >= 2s。

## 16. 后续可扩展（不在本次范围）

- 静态扫描学生 C++ 源码（独立 PR）。
- Webhook / Server-Sent Events 回调。
- BullMQ + Redis 替换 in-flight job。
- 物理 / 化学学科同模式接入。
- API Key 鉴权（替换 IP 限流）。
