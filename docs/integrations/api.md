# 第三方接入 API 文档

本接口允许第三方项目（如 Vjudge-AI-report）将 **C++ 错题** 提交到本系统，由本系统完成错题诊断并跳转生成学习课件。

> **重要约束**：
> - 只接受 **verdict + 题目文本**；**不要传输学生代码**。
> - 接口目前按调用方 IP 限流，**无 API Key**；上线前建议在反代层加 Bearer 鉴权。

---

## 1. 基础信息

| 项目 | 值 |
|---|---|
| 基础 URL | `https://<your-domain>` （开发：`http://localhost:3000`） |
| 协议 | HTTPS（生产） / HTTP（本地） |
| 内容类型 | `application/json; charset=utf-8` |
| 鉴权 | 无（按 IP 限流） |
| Job TTL | 24 小时 |
| 当前支持学科 | `cpp` |

---

## 2. 健康检查

`GET /api/integrations/health`

```json
{
  "success": true,
  "status": "ok",
  "version": "2026-07-02",
  "subjects": ["cpp"],
  "verdicts": ["AC", "WA", "TLE", "RE", "CE", "MLE", "PE"],
  "rateLimits": {
    "createPerMin": 10,
    "pollPerMin": 120,
    "retryPerMin": 10
  },
  "endpoints": {
    "submit": "POST /api/integrations/mistake",
    "poll": "GET /api/integrations/jobs/{jobId}",
    "retry": "POST /api/integrations/jobs/{jobId}/retry",
    "health": "GET /api/integrations/health"
  }
}
```

> 集成方应在启动时调一次 health，确认限流配置和服务可用性。

---

## 3. 提交错题

`POST /api/integrations/mistake`

### 请求体

```json
{
  "subject": "cpp",
  "grade": 10,
  "verdict": "WA",
  "title": "最长上升子序列",
  "problemType": "dp",
  "problemText": "给定一个长度为 n 的序列…",
  "studentAnswer": "3\n1 2 3",
  "correctAnswer": "3\n1 2 3",
  "source": "vjudge"
}
```

### 字段

| 字段 | 类型 | 必填 | 限制 | 说明 |
|---|---|---|---|---|
| `subject` | string | 是 | 固定 `"cpp"` | 学科 |
| `grade` | int | 是 | 1–12 | 学段 |
| `verdict` | enum | 是 | `AC`/`WA`/`TLE`/`RE`/`CE`/`MLE`/`PE` | 评测结果 |
| `problemText` | string | 是 | 1–8000 字 | 题目描述（不含代码） |
| `studentAnswer` | string | 否 | ≤ 4000 字 | 学生提交输出（不要发源码） |
| `correctAnswer` | string | 否 | ≤ 4000 字 | 标准答案 / 期望输出 |
| `problemType` | enum | 否 | `dp`/`greedy`/`brute`/`graph`/`string`/`math`/`other` | 题型 |
| `title` | string | 否 | ≤ 200 字 | 题目标题 |
| `source` | string | 否 | ≤ 64 字 | 业务来源标识，用于统计 |

### 响应 `201`

```json
{
  "success": true,
  "data": {
    "jobId": "cm7k3j9x1a",
    "status": "queued",
    "statusUrl": "/api/integrations/jobs/cm7k3j9x1a"
  }
}
```

### 错误

| 状态码 | errorCode | 触发 | 处理 |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | JSON 不合法 / 字段缺失 | 修正 payload |
| 415 | `INVALID_REQUEST` | Content-Type 不是 JSON | 加 `Content-Type: application/json` |
| 429 | `RATE_LIMITED` | 触发限流 | 按 `Retry-After` 头退避 |

---

## 4. 轮询任务状态

`GET /api/integrations/jobs/{jobId}`

### 响应 `200`

```json
{
  "success": true,
  "data": {
    "jobId": "cm7k3j9x1a",
    "status": "ready",
    "stage": null,
    "sessionId": "AbCdEf1234",
    "generationUrl": "/generation-preview?session=AbCdEf1234&from=integration",
    "classroomUrl": null,
    "error": null,
    "createdAt": "2026-07-02T10:00:00.000Z",
    "updatedAt": "2026-07-02T10:00:03.120Z"
  }
}
```

### status 流转

```
queued → running → ready        (成功)
queued → running → failed       (失败，可 retry)
```

| status | 含义 | 集成方行为 |
|---|---|---|
| `queued` | 排队中 | 继续轮询 |
| `running` | 诊断中 | 继续轮询 |
| `ready` | 已生成 session | 跳 `generationUrl` |
| `failed` | 失败 | 读取 `error`，可重试 |

### 错误

| 状态码 | errorCode | 触发 |
|---|---|---|
| 404 | `INTERNAL_ERROR` | jobId 不存在 |
| 410 | `INTERNAL_ERROR` | job 超过 24h TTL |
| 429 | `RATE_LIMITED` | 触发限流 |

### 推荐轮询节奏

- 提交后立即 1 次
- 之后每 **1.5s** 一次
- 超过 30s 仍在 `queued`/`running` 可降频到 **5s**
- 收到 `ready` 或 `failed` 即停止

---

## 5. 重试失败任务

`POST /api/integrations/jobs/{jobId}/retry`

仅 `status === "failed"` 的 job 可重试；会把状态重置为 `queued` 并重新执行诊断。

### 响应 `200`

```json
{
  "success": true,
  "data": {
    "jobId": "cm7k3j9x1a",
    "status": "queued",
    "statusUrl": "/api/integrations/jobs/cm7k3j9x1a"
  }
}
```

### 错误

| 状态码 | errorCode | 触发 |
|---|---|---|
| 404 | `INTERNAL_ERROR` | jobId 不存在 |
| 409 | `INVALID_REQUEST` | job 不在 `failed` 状态 |
| 410 | `INTERNAL_ERROR` | job 已过期 |

---

## 6. 用户跳转

`status === "ready"` 时，集成方应将浏览器跳转到：

```
<base-url> + generationUrl
```

例：`https://app.example.com/generation-preview?session=AbCdEf1234&from=integration`

前端 `/generation-preview` 页面会读取 `session` 参数加载诊断并启动课件生成。

---

## 7. 限流

按调用方 IP 滑动窗口（60s）。

| 端点 | 默认 | 覆盖环境变量 |
|---|---|---|
| POST `/api/integrations/mistake` | 10 / 分钟 | `RATE_LIMIT_INTEGRATION_CREATE_PER_MIN` |
| GET  `/api/integrations/jobs/:id` | 120 / 分钟 | `RATE_LIMIT_INTEGRATION_POLL_PER_MIN` |
| POST `/api/integrations/jobs/:id/retry` | 10 / 分钟 | `RATE_LIMIT_INTEGRATION_CREATE_PER_MIN` |

超限返回 `429`，响应头 `Retry-After: <秒数>`，集成方必须做退避。

---

## 8. CORS

如第三方前端是独立域名，需要在服务端环境变量配置：

```
INTEGRATION_CORS_ORIGINS="https://vjudge.example.com,https://other.example.com"
# 或完全开放（不推荐生产环境使用）
INTEGRATION_CORS_ORIGINS=*
```

不配置时跨域请求将被浏览器拦截；同源部署无需关心。

---

## 9. 端到端示例（Node / fetch）

```js
const BASE = process.env.MISTAKE_BASE_URL ?? 'http://localhost:3000';

async function submitAndWait(payload) {
  // 1. 提交
  const create = await fetch(`${BASE}/api/integrations/mistake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'cpp',
      grade: 10,
      verdict: payload.verdict,           // AC/WA/TLE/RE/CE/MLE/PE
      title: payload.title,
      problemType: payload.tag,            // 没有就删字段
      problemText: payload.problemStatement,
      studentAnswer: payload.userOutput,   // 不要传 student code
      correctAnswer: payload.expectedOutput,
      source: 'vjudge',
    }),
  });

  if (create.status === 429) {
    const sec = Number(create.headers.get('Retry-After') ?? '5');
    await new Promise((r) => setTimeout(r, sec * 1000));
    return submitAndWait(payload);
  }
  if (!create.ok) throw new Error(`submit failed: ${create.status}`);

  const { data: { jobId, statusUrl } } = await create.json();

  // 2. 轮询
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 1500 : 5000));
    const r = await fetch(`${BASE}${statusUrl}`);
    if (r.status === 429) {
      const sec = Number(r.headers.get('Retry-After') ?? '5');
      await new Promise((res) => setTimeout(res, sec * 1000));
      continue;
    }
    const { data } = await r.json();
    if (data.status === 'ready') {
      return `${BASE}${data.generationUrl}`;
    }
    if (data.status === 'failed') {
      throw new Error(data.error?.message ?? 'job failed');
    }
  }
  throw new Error('job timeout');
}

// 用法
const generationUrl = await submitAndWait({
  verdict: 'WA',
  title: '最长上升子序列',
  tag: 'dp',
  problemStatement: '…',
  userOutput: '3\n1 2 3',
  expectedOutput: '3\n1 2 3',
});

// 跳到 generation-preview
window.location.href = generationUrl;
```

---

## 10. 错误码速查

| errorCode | 状态码 | 含义 |
|---|---|---|
| `INVALID_REQUEST` | 400 | 请求体不合法 |
| `INVALID_REQUEST` | 415 | Content-Type 错误 |
| `INVALID_REQUEST` | 409 | 状态冲突（如重试非 failed 的 job） |
| `RATE_LIMITED` | 429 | 触发限流 |
| `INTERNAL_ERROR` | 404 | 资源不存在 |
| `INTERNAL_ERROR` | 410 | 资源已过期 |
| `INTERNAL_ERROR` | 5xx | 服务端异常 |

---

## 11. 常见问题

**Q：能传学生代码吗？**
A：不能。`studentAnswer` 字段只接受学生**输出**或**答案**，不要发源码。原因：① 隐私合规；② 诊断模型基于 verdict+题目文本，不需要源码。

**Q：jobId 多久过期？**
A：24 小时。过期后再访问会返回 410，需要重新提交。

**Q：限流按什么维度？**
A：按调用方公网 IP（X-Forwarded-For 的第一个）。如果你们走后端代理转发，记得在反代里把真实 IP 透传过来。

**Q：要不要加 API Key？**
A：当前没有，但生产前建议在反代层加 Bearer Token 鉴权（按调用方发 token），避免被滥用。

**Q：能直接传数学题吗？**
A：当前只支持 `subject: "cpp"`。数学题走前端拍照/上传流程即可。
