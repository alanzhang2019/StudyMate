# AI 学习诊断报告持久化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已经生成的 CSP 真题卷 AI 学习诊断报告"直接打开"即可,不再每次重新生成。现状是 in-process LRU 5min TTL,服务重启/多副本/页面刷新都会重算,烧 token 也浪费时间。

**Architecture:** 二段式缓存:
1. **后端 SQLite 持久化** (`csp_paper_analysis_reports` 表): 一份报告挂到 `(userId, classroomId)` 上, 错题变了就 UPSERT 覆盖, 错题没变永久复用。解决"服务重启/跨部署/跨进程"。
2. **前端 localStorage 缓存** (`paper_analysis:<classroomId>`): 打开 modal 时先读 localStorage, 命中就秒开, 不打网络。解决"打开就要走一次 fetch"。
3. **保留 in-process LRU** 作为一级缓存 (热路径), db 作为二级缓存 (冷路径)。L1 命中不读 db, L1 miss 走 db, L2 命中回填 L1。

**Tech Stack:** Next.js 14 App Router · TypeScript · better-sqlite3 · React 18 useState

---

## 问题陈述

2026-08-12 用户反馈: "AI 报告不要每次重新生成,已经生成的直接打开即可"。

### 根因

`frontend/lib/server/csp-paper-analysis.ts` 的 `generatePaperAnalysis()` 用 Map 做 in-process LRU 缓存:

```ts
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { report: PaperAnalysisReport; at: number }>();
```

- 服务重启 → Map 丢失
- 多副本部署 (前端 container replicas > 1) → 每个副本各自一份
- 5 分钟 TTL 短, 学生关掉 modal 再开就过期
- 学生改答案错题变了 → 旧报告按 cacheKey 失效,但重算又走 LLM

### 方案对比

| 方案 | 持久化 | 跨设备 | 复杂度 | 命中率 | 选不选 |
|------|--------|--------|--------|--------|--------|
| A 只前端 localStorage | 浏览器 | 否 | 低 | 首次快 | 选 |
| B 只后端 SQLite | 数据库 | 是 | 中 | 二级 | 选 |
| **C 前端 + 后端二级** | **都** | **是** | **中** | **最快 + 最全** | **选** |

用户选 C。

---

## 实施 (3 个 task)

### Task 1: 后端 SQLite 持久化表 + 模型

**Files:**
- Modify: `frontend/lib/db.ts:352-385` (新增 csp_paper_analysis_reports schema 块)
- Modify: `frontend/lib/db.ts:1054-1141` (新增 cspPaperAnalysisReport 模型)
- Test: 已有 db.ts 编译通过 + runtime schema init 测试 (现有 vitest 已覆盖 getDb)

- [x] **Step 1.1: 在 schema 块中添加新表**

```sql
CREATE TABLE IF NOT EXISTS csp_paper_analysis_reports (
  userId TEXT NOT NULL,
  classroomId TEXT NOT NULL,
  cacheKey TEXT NOT NULL,
  wrongQuestionIdsJson TEXT NOT NULL,
  totalCount INTEGER NOT NULL,
  wrongCount INTEGER NOT NULL,
  score REAL NOT NULL,
  reportJson TEXT NOT NULL,
  generatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (userId, classroomId)
);
CREATE INDEX IF NOT EXISTS idx_csp_par_user_updated
  ON csp_paper_analysis_reports (userId, updatedAt DESC);
```

要点:
- PRIMARY KEY `(userId, classroomId)`: 同一学生同一套卷子永远只保留最新一份, 旧报告直接 UPSERT 覆盖
- `cacheKey`: hash(classroomId + userId + sorted(wrongIds)), 校验错题是否变了
- `reportJson`: 整个 PaperAnalysisReport 序列化为 JSON 字符串 (TEXT)
- 不留历史, 没必要 (学生只会看最新一次)

- [x] **Step 1.2: 在 PrismaCompatClient 添加 cspPaperAnalysisReport 模型**

```ts
cspPaperAnalysisReport = {
  findByUserClassroom: (userId, classroomId) => { ... },
  upsert: ({ userId, classroomId, cacheKey, wrongQuestionIds, totalCount, wrongCount, score, reportJson }) => { ... },
  deleteByUserClassroom: (userId, classroomId) => { ... },
}
```

要点:
- `upsert` 走 `ON CONFLICT(userId, classroomId) DO UPDATE SET` 覆盖所有字段
- `upsert` 返回最新 row (方便上层用 row.cacheKey 校验)
- 不依赖 `buildFinder` (不需要 findUnique/findMany, 接口简单)

### Task 2: csp-paper-analysis.ts 接入 db 缓存

**Files:**
- Modify: `frontend/lib/server/csp-paper-analysis.ts:205-305` (新增 computeCacheKey / read/write 辅助)
- Modify: `frontend/lib/server/csp-paper-analysis.ts:707-840` (改 generatePaperAnalysis 走二段缓存)

- [x] **Step 2.1: 导出 computePaperAnalysisCacheKey 辅助函数**

```ts
export function computePaperAnalysisCacheKey(
  userId: string,
  classroomId: string,
  wrongQuestionIds: string[],
): string {
  return hashKey([
    classroomId,
    userId,
    ...[...wrongQuestionIds].sort(),  // 关键: 排序, 否则 entries 顺序不同 hash 不同
  ]);
}
```

- [x] **Step 2.2: 实现 readPersistedReport / writePersistedReport 辅助**

```ts
async function readPersistedReport(userId, classroomId, cacheKey) {
  const row = db.cspPaperAnalysisReport.findByUserClassroom(userId, classroomId);
  if (!row || row.cacheKey !== cacheKey) return null;  // 错题变了, 老报告失效
  const parsed = JSON.parse(row.reportJson);
  return { ...parsed, meta: { ...parsed.meta, classroomId, cached: true, generatedAt: row.generatedAt } };
}

async function writePersistedReport(...) {
  db.cspPaperAnalysisReport.upsert({ ... });
}
```

要点:
- db read 失败 → 返回 null, 不影响主流程 (warn 日志即可)
- db write 失败 → 静默 warn, 不影响主流程 (best-effort)
- cacheKey 不匹配 → 返回 null, 让上游重新生成

- [x] **Step 2.3: 改 generatePaperAnalysis 走 L1 (LRU) → L2 (db) → LLM**

```ts
if (!options.forceRefresh) {
  // L1: 同进程内热路径
  const hot = cacheGet(cacheKey);
  if (hot) return { ...hot, meta: { ...hot.meta, cached: true } };
  // L2: db 持久化
  const cold = await readPersistedReport(userId, classroomId, cacheKey);
  if (cold) {
    cachePut(cacheKey, cold);  // 回填 L1
    return cold;
  }
}
// L3: 调 LLM
...
cachePut(cacheKey, report);  // 写 L1
void writePersistedReport(...);  // 异步写 L2, 不阻塞返回
return report;
```

### Task 3: 前端 localStorage 缓存

**Files:**
- Modify: `frontend/components/csp-lecture/paper-analysis-report.tsx:170-281` (新增 loadFromLocalStorage / saveToLocalStorage 工具 + 接入 useEffect)

- [x] **Step 3.1: 实现 loadFromLocalStorage / saveToLocalStorage 工具**

```ts
const STORAGE_PREFIX = 'paper_analysis:';

function loadFromLocalStorage(classroomId: string): Report | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + classroomId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Report;
    if (parsed?.meta?.classroomId !== classroomId) {
      window.localStorage.removeItem(STORAGE_PREFIX + classroomId);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveToLocalStorage(report: Report): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_PREFIX + report.meta.classroomId, JSON.stringify(report)); }
  catch { /* 配额超限 / 隐私模式: 静默 */ }
}
```

要点:
- 防御 `meta.classroomId !== classroomId` (防跨卷子串号)
- localStorage 失败一律静默 (隐私模式 / quota)

- [x] **Step 3.2: useEffect 优先读 localStorage, 失败才 fetch**

```ts
useEffect(() => {
  if (open) {
    if (!report || report.meta.classroomId !== classroomId) {
      const cached = loadFromLocalStorage(classroomId);
      if (cached) { setReport(cached); return; }  // 秒开
      void fetchReport(false);  // 走网络
    }
  } else {
    setError(null);
  }
}, [open, classroomId]);
```

- [x] **Step 3.3: fetch 成功后写回 localStorage**

```ts
const next = json.report as Report;
setReport(next);
saveToLocalStorage(next);  // 不管 forceRefresh 与否, 都写最新
```

---

## 验证 (浏览器)

部署后:
1. 进入 2016 CSP-J 真题卷 (`cm_imp_cspj2016j_v1`) → 交卷 → 弹出"AI 智能分析"按钮 → 点击
2. 第一次会走 LLM, 等待 15-30s, 报告渲染, localStorage + db 都被写
3. 关闭 modal, 再开 → 应该秒开 (走 localStorage), 右上有"缓存"徽章
4. 刷新页面 / 关浏览器再开 → 仍然秒开 (走 localStorage)
5. 杀掉前端 container (`docker compose restart frontend`) → 再开 → 仍然秒开 (走 db)
6. 重答某道题让错题列表变 → 再开 → 触发新 LLM, 错题没变回 1 → 重新秒开 (新错题 cacheKey 变了, db 写入新报告覆盖旧的)
7. DevTools → Application → Local Storage 看到 `paper_analysis:cm_imp_cspj2016j_v1` 键
8. 后台 `sqlite3 /home/ubuntu/studymate/data/studymate.db "SELECT userId, classroomId, cacheKey, updatedAt FROM csp_paper_analysis_reports"` 能看到一行

---

## 失败兜底 / 边界条件

- **隐私模式 / quota 超限**: localStorage 读写静默吞掉, 退化到"每次都打后端", 但后端 db 还在, 所以只是比有 localStorage 时多一次 HTTP
- **db 文件损坏 / 不可写**: db 读写 warn 后吞掉, 退化到"in-process LRU 5min", 不至于报错
- **多设备登录同一学生**: db 共享, 但 localStorage 不共享; 设备 A 看过的报告在设备 B 上仍要走 fetch (但 fetch 命中 db 直接秒返)
- **学生重置卷子**: 现状 csp-progress 重置只清 submissions, 没清 reports; 后续如果出现"重置后老报告还在"的 bug, 调 `cspPaperAnalysisReport.deleteByUserClassroom()` 即可, 接口已留
- **错题变了的语义**: cacheKey 是 hash(classroomId+userId+sortedWrongIds), 错题列表变了 cacheKey 必变, 老报告自动失效
