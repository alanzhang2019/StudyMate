// @ts-nocheck -- TypeScript types in this compatibility shim are not worth pinning down.
// Runtime behaviour is exercised by the app/api routes.

// Implements the minimum surface that the app/api routes rely on
// (user / studentProfile / mistakeRecord / systemConfig) without
// requiring prisma generate or a schema file.

import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync } from 'fs'

type Row = Record<string, any>

const DB_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate'
const DB_PATH = path.join(DB_DIR, 'studymate.sqlite')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

let _db: Database | null = null
let _dbInit: boolean = false

function tableExists(db: Database, name: string): boolean {
  try {
    db.prepare(`SELECT 1 FROM ${name} LIMIT 1`).get()
    return true
  } catch {
    return false
  }
}

export function getDb(): Database {
  if (!_db) {
    // During Next.js's `next build` (page data collection), each worker
    // process can hit this code path simultaneously. Use a per-process
    // in-memory database in that exact phase so the workers do not race
    // on the same on-disk file.
    //
    // IMPORTANT: only match on the explicit `NEXT_PHASE` env var that
    // Next.js sets to `phase-production-build` while running `next build`.
    // We previously also checked `process.argv.includes('build')`, which
    // silently matched the runtime command line of `next start` (the
    // Node process tree of `pnpm start` happens to contain the substring
    // "build") and sent every production request at a throwaway
    // `:memory:` database — which is why `/api/admin/config` returned
    // 500s even though the route compiled cleanly.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    if (isBuildPhase) {
      _db = new Database(':memory:')
      _db.pragma('journal_mode = MEMORY')
    } else {
      _db = new Database(DB_PATH)
      _db.pragma('journal_mode = WAL')
      _db.pragma('busy_timeout = 10000')
      _db.pragma('synchronous = NORMAL')
    }
  }
  if (!_dbInit || !tableExists(_db, 'parent_invite_codes')) {
    _dbInit = false
    _db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    -- role: 'parent' (default for legacy accounts), 'student' (direct-login
    -- student account for /csp-lecture and similar), 'admin' (backstage).
    -- Backward-compat: existing rows have NULL and the helper getRole()
    -- below returns 'parent' for them.
    role TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY,
    parentId TEXT NOT NULL,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    teachingStyle TEXT NOT NULL,
    ttsVoice TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_student_profiles_parentId ON student_profiles(parentId);

  -- mistake_book: a per-visitor "favourites" / "saved mistakes" list.
  -- Separate from mistake_records (which is bound to a logged-in
  -- parent/student pair) so anonymous users can still build up a
  -- personal collection before signing in. Once a visitor signs in,
  -- a future migration can copy rows whose visitorId matches their
  -- account into mistake_records if the user wants them merged.
  CREATE TABLE IF NOT EXISTS mistake_book (
    id TEXT PRIMARY KEY,
    visitorId TEXT NOT NULL,
    imageUrl TEXT,
    problemText TEXT NOT NULL,
    userAnswer TEXT,
    correctAnswer TEXT,
    classroomId TEXT,
    sessionId TEXT,
    subject TEXT,
    grade TEXT,
    title TEXT,
    isResolved INTEGER NOT NULL DEFAULT 0,
    resolvedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mistake_book_visitor_created
    ON mistake_book (visitorId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_mistake_book_visitor_resolved
    ON mistake_book (visitorId, isResolved);

  CREATE TABLE IF NOT EXISTS mistake_records (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    parentId TEXT NOT NULL,
    question TEXT NOT NULL,
    userAnswer TEXT NOT NULL,
    correctAnswer TEXT NOT NULL,
    isResolved INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (studentId) REFERENCES student_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mistake_records_studentId ON mistake_records(studentId);

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    eventName TEXT NOT NULL,
    payload TEXT,
    visitorId TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_usage_events_name_time
    ON usage_events (eventName, createdAt);
  CREATE INDEX IF NOT EXISTS idx_usage_events_visitor_time
    ON usage_events (visitorId, createdAt);

  -- parent_invite_codes: short-lived binding codes (6 digits, 10 min)
  -- generated by the student to invite their parents.
  CREATE TABLE IF NOT EXISTS parent_invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    studentVisitorId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_invite_codes_code
    ON parent_invite_codes (code);
  CREATE INDEX IF NOT EXISTS idx_invite_codes_student
    ON parent_invite_codes (studentVisitorId, createdAt DESC);

  -- parent_bindings: durable parent ↔ student relationship created
  -- when a parent successfully redeems an invite code. parentVisitorId
  -- is auto-generated on first redeem and persisted via cookie.
  CREATE TABLE IF NOT EXISTS parent_bindings (
    id TEXT PRIMARY KEY,
    parentVisitorId TEXT NOT NULL,
    studentVisitorId TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    revokedAt TEXT,
    revokedBy TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_parent_bindings_parent
    ON parent_bindings (parentVisitorId, revokedAt);
  CREATE INDEX IF NOT EXISTS idx_parent_bindings_student
    ON parent_bindings (studentVisitorId, revokedAt);

  -- parent_ai_insights: cached KIMI-generated dashboard commentary.
  -- Validated by mistakeHash so any change to the student's mistake
  -- set automatically invalidates the cache without explicit cleanup.
  CREATE TABLE IF NOT EXISTS parent_ai_insights (
    id TEXT PRIMARY KEY,
    studentVisitorId TEXT NOT NULL,
    content TEXT NOT NULL,
    mistakeHash TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    generatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ai_insights_student_generated
    ON parent_ai_insights (studentVisitorId, generatedAt DESC);

  -- integration_jobs: third-party integrations (e.g. Vjudge-AI-report).
  -- Each row represents one externally-submitted problem. We kick off
  -- an in-process job that prepares a mistake session, then let the
  -- browser load /generation-preview to drive the LLM + media pipeline.
  CREATE TABLE IF NOT EXISTS integration_jobs (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    source TEXT,
    requestPayload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT,
    sessionId TEXT,
    classroomId TEXT,
    errorCode TEXT,
    errorMessage TEXT,
    ip TEXT,
    ua TEXT,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_ip_time
    ON integration_jobs (ip, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_status
    ON integration_jobs (status, createdAt DESC);

  -- csp_progress: per-user classroom viewing progress. One row per
  -- (userId, classroomId). viewedScenes is a JSON array of
  -- sceneIds the user has fully watched (TTS/audio ended at least
  -- once for that scene). watchSeconds is cumulative wall-clock
  -- time the user has spent on this classroom, accumulated by
  -- 30s heartbeats. coveragePct is denormalised as
  -- viewedScenes.length / totalScenes for fast sort/filter.
  -- lastViewedSceneId and lastViewedAt are convenience fields
  -- for "continue where you left off" links on /student/home.
  -- completedAt is set by lib/server/csp-completion.ts the first
  -- time the student meets the punch-in criteria (coveragePct
  -- >= 0.8 AND every quiz scene is 100% correct). Once set it
  -- is never cleared ("latch" semantic) — re-takes that drop
  -- the quiz score don't undo a previously-granted punch-in.
  CREATE TABLE IF NOT EXISTS csp_progress (
    userId TEXT NOT NULL,
    classroomId TEXT NOT NULL,
    totalScenes INTEGER NOT NULL DEFAULT 0,
    viewedScenes TEXT NOT NULL DEFAULT '[]',
    watchSeconds INTEGER NOT NULL DEFAULT 0,
    coveragePct REAL NOT NULL DEFAULT 0,
    lastViewedSceneId TEXT,
    lastViewedAt TEXT,
    completedAt TEXT,
    -- viewedSceneSeconds: per-scene "active" watch time
    -- (visible AND on this scene), stored as a JSON map
    -- { [sceneId]: seconds }. Used by scene-complete to
    -- enforce that a student actually spent time on the
    -- scene rather than just rapid-clicking through. Populated
    -- only on writes that include the clientActiveWatchSeconds
    -- field; older rows default to '{}' (no per-scene
    -- enforcement data, which is why we also allow
    -- "trust-but-log" fallback when the client omits the field).
    viewedSceneSeconds TEXT NOT NULL DEFAULT '{}',
    -- auditFlags: JSON array of { kind, at, details }
    -- entries for suspicious activity we want to surface in
    -- the UI without blocking the write. Kinds in use:
    --   - "suspicious_jump" — coveragePct increased >30% in
    --     <60s, suggesting scripted POSTs. Surfaced as a ⚠ on
    --     the student home row.
    auditFlags TEXT NOT NULL DEFAULT '[]',
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (userId, classroomId)
  );
  CREATE INDEX IF NOT EXISTS idx_csp_progress_classroom_coverage
    ON csp_progress (classroomId, coveragePct DESC);
  CREATE INDEX IF NOT EXISTS idx_csp_progress_user_updated
    ON csp_progress (userId, updatedAt DESC);

  -- csp_quiz_submissions: per-user quiz answers. One row per
  -- (userId, classroomId, sceneId) — we use upsert semantics so a
  -- student can re-take a quiz and only the latest submission
  -- counts. answersJson is the full per-question detail
  -- [{questionId, choice, correct, ms}]; score is pre-computed
  -- server-side (0-100, = correctCount / totalQuestions * 100) so
  -- the teacher dashboard can sum and average without re-scoring.
  CREATE TABLE IF NOT EXISTS csp_quiz_submissions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    classroomId TEXT NOT NULL,
    sceneId TEXT NOT NULL,
    totalQuestions INTEGER NOT NULL,
    correctCount INTEGER NOT NULL,
    score REAL NOT NULL,
    answersJson TEXT NOT NULL,
    submittedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (userId, classroomId, sceneId)
  );
  CREATE INDEX IF NOT EXISTS idx_csp_quiz_user_classroom
    ON csp_quiz_submissions (userId, classroomId);
  CREATE INDEX IF NOT EXISTS idx_csp_quiz_classroom_score
    ON csp_quiz_submissions (classroomId, score DESC);
`)

    // Idempotent column migration for usage_events. We can't add
    // it inside the CREATE TABLE block above because 'IF NOT EXISTS'
    // skips the whole statement when the table already exists.
    // Wrapping the ALTER in try/catch keeps this safe to run on
    // every boot — older better-sqlite3 throws if the column is
    // already present, which is the common case after the first
    // deploy with this migration.
    try {
      _db.exec('ALTER TABLE usage_events ADD COLUMN visitorId TEXT')
    } catch {
      // column already exists
    }

    // Idempotent column migration for users: add `name` and `role`
    // to existing databases. The CREATE TABLE above already includes
    // them for fresh installs. The role column stays nullable so
    // existing accounts don't need a backfill — application code
    // falls back to 'parent' for NULL values (see getRole helper).
    try {
      _db.exec("ALTER TABLE users ADD COLUMN name TEXT")
    } catch {
      // column already exists
    }
    try {
      _db.exec("ALTER TABLE users ADD COLUMN role TEXT")
    } catch {
      // column already exists
    }

    // Idempotent column migration for csp_progress: add
    // viewedSceneSeconds + auditFlags. These two power the
    // anti-fast-click defenses (lib/server/csp-completion.ts +
    // /api/csp-progress/scene-complete). Older rows default to
    // '{}' and '[]' respectively; the per-scene min threshold
    // is then unenforced (a soft "trust" fallback) but the
    // auditFlags array will start populating on the next
    // suspicious write so the teacher dashboard can still
    // surface anomalies for legacy progress rows.
    try {
      _db.exec(
        "ALTER TABLE csp_progress ADD COLUMN viewedSceneSeconds TEXT NOT NULL DEFAULT '{}'",
      )
    } catch {
      // column already exists
    }
    try {
      _db.exec(
        "ALTER TABLE csp_progress ADD COLUMN auditFlags TEXT NOT NULL DEFAULT '[]'",
      )
    } catch {
      // column already exists
    }

    // Only flip the flag once the schema actually finished applying
    // — otherwise an exception from `_db.exec` would leave us in a
    // "tried but never succeeded" state and every subsequent call
    // would short-circuit straight to `return _db` with a partial
    // schema. This used to be set BEFORE the exec, which silently
    // masked a typo in the inner SQL on hot reload.
    _dbInit = true
  }
  return _db
}

const now = () => new Date().toISOString()
const cid = () => randomUUID()

function rowToCamel<T extends Row>(row: T): T {
  if (!row) return row
  const out: Row = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = row[key]
  }
  return out as T
}

function buildFinder(table: string, idColumn: string) {
  return {
    findUnique: ({ where, select }: { where: Row; select?: Row } = { where: {} }) => {
      const entries = Object.entries(where)
      if (entries.length !== 1) {
        throw new Error(`${table}.findUnique requires a single where clause`)
      }
      const [col, val] = entries[0]
      const sqlCol = col
      const stmt = getDb().prepare(`SELECT * FROM ${table} WHERE ${sqlCol} = ? LIMIT 1`)
      const row = stmt.get(val)
      if (!row) return null
      const camel = rowToCamel(row as Row)
      if (select) {
        const out: Row = {}
        for (const k of Object.keys(select)) {
          if (select[k] && (k in camel)) out[k] = camel[k]
        }
        return out
      }
      return camel
    },
    findFirst: ({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k} ${dir}`
      }
      sql += ' LIMIT 1'
      const row = getDb().prepare(sql).get(...params)
      return row ? rowToCamel(row as Row) : null
    },
    findMany: ({ where, orderBy, take, select }: { where?: Row; orderBy?: Row; take?: number; select?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k} ${dir}`
      }
      if (typeof take === 'number') sql += ` LIMIT ${take}`
      const rows = getDb().prepare(sql).all(...params) as Row[]
      return rows.map((row) => {
        const camel = rowToCamel(row)
        if (select) {
          const out: Row = {}
          for (const k of Object.keys(select)) {
            if (select[k] && (k in camel)) out[k] = camel[k]
          }
          return out
        }
        return camel
      })
    },
    create: ({ data }: { data: Row }) => {
      const id = data.id ?? cid()
      const createdAt = data.createdAt ?? now()
      const fields: Row = { id, ...data, createdAt }
      const cols = Object.keys(fields)
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map((c) => fields[c])
      getDb()
        .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        .run(...values)
      const row = getDb()
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .get(id) as Row
      return rowToCamel(row)
    },
    update: ({ where, data }: { where: Row; data: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const setParts: string[] = []
      const params: any[] = []
      for (const [k, v] of Object.entries(data)) {
        setParts.push(`${k} = ?`)
        params.push(v)
      }
      params.push(wval)
      getDb()
        .prepare(`UPDATE ${table} SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`)
        .run(...params)
      const row = getDb()
        .prepare(`SELECT * FROM ${table} WHERE ${sqlCol} = ?`)
        .get(wval) as Row
      return rowToCamel(row)
    },
    upsert: ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const existing = getDb().prepare(`SELECT id FROM ${table} WHERE ${sqlCol} = ?`).get(wval) as { id: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k} = ?`)
          params.push(v)
        }
        params.push(wval)
        getDb()
          .prepare(`UPDATE ${table} SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`)
          .run(...params)
      } else {
        const id = (create as Row).id ?? cid()
        const createdAt = (create as Row).createdAt ?? now()
        const fields: Row = { id, ...create, createdAt }
        const cols = Object.keys(fields)
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => fields[c])
        getDb()
          .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
          .run(...values)
      }
      return { id: (create as Row).id ?? existing?.id ?? wval }
    },
    delete: ({ where }: { where: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      getDb().prepare(`DELETE FROM ${table} WHERE ${sqlCol} = ?`).run(wval)
      return { id: wval }
    },
    count: ({ where }: { where?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT COUNT(*) as n FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      const row = getDb().prepare(sql).get(...params) as { n: number }
      return row?.n ?? 0
    },
  }
}

function withCount<T extends Row>(rows: T[], countField: string): (T & { _count: { [k: string]: number } })[] {
  return rows.map((r) => ({ ...r, _count: { [countField]: 0 } }))
}

class PrismaCompatClient {
  user = {
    ...buildFinder('users', 'id'),
    findMany: (args: any) => {
      const rows = buildFinder('users', 'id').findMany(args)
      if (args?.select?._count?.select?.studentProfiles) {
        return rows.map((u: any) => ({
          ...u,
          _count: { profiles: getDb().prepare('SELECT COUNT(*) as n FROM student_profiles WHERE parentId = ?').get(u.id)?.n ?? 0 },
        }))
      }
      return rows
    },
  }
  studentProfile = {
    ...buildFinder('student_profiles', 'id'),
    findUnique: (args: any) => {
      const row = buildFinder('student_profiles', 'id').findUnique(args)
      return row
    },
  }
  mistakeRecord = buildFinder('mistake_records', 'id')
  mistakeBook = buildFinder('mistake_book', 'id')
  // usage_events has no `id` column in the schema (wait — it does, it's
  // a UUID primary key), so buildFinder works as-is. The `eventName`
  // column is what we filter on in /api/admin/stats.
  usageEvent = buildFinder('usage_events', 'id')
  parentInviteCode = buildFinder('parent_invite_codes', 'id')
  parentBinding = buildFinder('parent_bindings', 'id')
  parentAiInsight = buildFinder('parent_ai_insights', 'id')
  integrationJob = buildFinder('integration_jobs', 'id')
  // csp_progress has a composite primary key (userId, classroomId),
  // so it can't use buildFinder directly. We expose a tiny model
  // that uses raw SQL for the upsert/read operations the progress
  // API needs. All other access should go through this object so
  // the composite-key convention stays in one place.
  cspProgress = {
    findByUserClass: (userId: string, classroomId: string) => {
      const row = getDb()
        .prepare('SELECT * FROM csp_progress WHERE userId = ? AND classroomId = ? LIMIT 1')
        .get(userId, classroomId) as any
      return row ?? null
    },
    findManyByUser: (userId: string) => {
      return getDb()
        .prepare('SELECT * FROM csp_progress WHERE userId = ? ORDER BY updatedAt DESC')
        .all(userId) as any[]
    },
    // findAll: every csp_progress row across every user. Used by
    // the teacher-side /api/admin/csp-progress/overview route
    // to build a per-student aggregate without per-user
    // round-trips. Returns the same shape as findManyByUser.
    // Order: most recently updated first so the route can
    // cheaply pick "last active" by walking the top row per
    // user if it wanted to (we don't — the route does its own
    // bucketing — but the order is convenient either way).
    findAll: () => {
      return getDb()
        .prepare('SELECT * FROM csp_progress ORDER BY updatedAt DESC')
        .all() as any[]
    },
    upsertViewedScene: (params: {
      userId: string
      classroomId: string
      sceneId: string
      totalScenes: number
      viewedScenes: string  // JSON
      coveragePct: number
      lastViewedAt: string
      completedAt: string | null
      // Optional: the per-scene active-watch-time JSON map
      // {"sceneId": seconds}. If omitted, the column is left
      // untouched (i.e. preserved across this upsert). The
      // route handler builds the merged map (existing ‖
      // new scene's seconds) and passes it back in.
      viewedSceneSeconds?: string
    }) => {
      // Upsert: if the row exists, preserve its `watchSeconds`
      // (heartbeats write that column separately) and only
      // update scene-related fields. If not, create with 0
      // watchSeconds and let heartbeats fill it in.
      // The viewedSceneSeconds merge is done in JS by the
      // caller (we don't want to do JSON merge in SQL — too
      // easy to clobber older entries).
      const sql = params.viewedSceneSeconds
        ? `
        INSERT INTO csp_progress
          (userId, classroomId, totalScenes, viewedScenes, watchSeconds, coveragePct, lastViewedSceneId, lastViewedAt, completedAt, viewedSceneSeconds, updatedAt)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, classroomId) DO UPDATE SET
          totalScenes = excluded.totalScenes,
          viewedScenes = excluded.viewedScenes,
          coveragePct = excluded.coveragePct,
          lastViewedSceneId = excluded.lastViewedSceneId,
          lastViewedAt = excluded.lastViewedAt,
          completedAt = excluded.completedAt,
          viewedSceneSeconds = excluded.viewedSceneSeconds,
          updatedAt = excluded.updatedAt
      `
        : `
        INSERT INTO csp_progress
          (userId, classroomId, totalScenes, viewedScenes, watchSeconds, coveragePct, lastViewedSceneId, lastViewedAt, completedAt, updatedAt)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, classroomId) DO UPDATE SET
          totalScenes = excluded.totalScenes,
          viewedScenes = excluded.viewedScenes,
          coveragePct = excluded.coveragePct,
          lastViewedSceneId = excluded.lastViewedSceneId,
          lastViewedAt = excluded.lastViewedAt,
          completedAt = excluded.completedAt,
          updatedAt = excluded.updatedAt
      `
      const stmt = getDb().prepare(sql)
      if (params.viewedSceneSeconds) {
        stmt.run(
          params.userId,
          params.classroomId,
          params.totalScenes,
          params.viewedScenes,
          params.coveragePct,
          params.sceneId,
          params.lastViewedAt,
          params.completedAt,
          params.viewedSceneSeconds,
          params.lastViewedAt,
        )
      } else {
        stmt.run(
          params.userId,
          params.classroomId,
          params.totalScenes,
          params.viewedScenes,
          params.coveragePct,
          params.sceneId,
          params.lastViewedAt,
          params.completedAt,
          params.lastViewedAt,
        )
      }
      return cspProgress.findByUserClass(params.userId, params.classroomId)
    },
    // appendAuditFlag: append an entry to the auditFlags JSON
    // array. We dedupe on (kind) so the array doesn't grow
    // unbounded across many writes (eg every rapid-fire
    // scene-complete would otherwise spam identical entries).
    // The dedupe keeps the most recent timestamp/details.
    appendAuditFlag: (
      userId: string,
      classroomId: string,
      flag: { kind: string; at: string; details: Record<string, unknown> },
    ) => {
      const row = cspProgress.findByUserClass(userId, classroomId)
      let arr: any[] = []
      try {
        const parsed = JSON.parse(row?.auditFlags ?? '[]')
        if (Array.isArray(parsed)) arr = parsed
      } catch {
        arr = []
      }
      // Replace the latest entry of the same kind (we want
      // the freshest "at" and details), or append if new.
      const without = arr.filter((f) => f?.kind !== flag.kind)
      without.push(flag)
      getDb()
        .prepare(
          `UPDATE csp_progress
             SET auditFlags = ?, updatedAt = datetime('now')
           WHERE userId = ? AND classroomId = ?`,
        )
        .run(JSON.stringify(without), userId, classroomId)
      return cspProgress.findByUserClass(userId, classroomId)
    },
    addWatchSeconds: (userId: string, classroomId: string, deltaSeconds: number) => {
      // Heartbeat accumulator. We clamp the value at 0 in case
      // a buggy client sends a negative delta. Total classroom
      // time should never be negative.
      getDb()
        .prepare(
          `UPDATE csp_progress
             SET watchSeconds = MAX(0, watchSeconds + ?),
                 updatedAt = datetime('now')
           WHERE userId = ? AND classroomId = ?`,
        )
        .run(deltaSeconds, userId, classroomId)
      return cspProgress.findByUserClass(userId, classroomId)
    },
    // setCompletedAt: write the "first time the student met the
    // completion criteria" timestamp. Idempotent and
    // intentionally NEVER cleared by this module — the latch
    // semantic is enforced by the caller (csp-completion.ts),
    // which checks `!existing.completedAt` before calling this.
    // A null `completedAt` argument is accepted for symmetry
    // (future use: e.g. a teacher-side "uncomplete" tool) but
    // is NOT part of the normal write path; don't call it
    // without a product reason.
    setCompletedAt: (
      userId: string,
      classroomId: string,
      completedAt: string | null,
    ) => {
      getDb()
        .prepare(
          `UPDATE csp_progress
             SET completedAt = ?, updatedAt = datetime('now')
           WHERE userId = ? AND classroomId = ?`,
        )
        .run(completedAt, userId, classroomId)
      return cspProgress.findByUserClass(userId, classroomId)
    },
  }
  cspQuizSubmission = {
    findByUser: (userId: string, classroomId: string) => {
      return getDb()
        .prepare(
          'SELECT * FROM csp_quiz_submissions WHERE userId = ? AND classroomId = ? ORDER BY submittedAt DESC',
        )
        .all(userId, classroomId) as any[]
    },
    findByUserScene: (userId: string, classroomId: string, sceneId: string) => {
      const row = getDb()
        .prepare(
          'SELECT * FROM csp_quiz_submissions WHERE userId = ? AND classroomId = ? AND sceneId = ? LIMIT 1',
        )
        .get(userId, classroomId, sceneId) as any
      return row ?? null
    },
    upsert: (params: {
      userId: string
      classroomId: string
      sceneId: string
      totalQuestions: number
      correctCount: number
      score: number
      answersJson: string
    }) => {
      // Re-take semantics: a student can re-submit a quiz, and
      // we keep only the latest score (UNIQUE on the
      // userId+classroomId+sceneId tuple).
      const id = `qsub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      getDb()
        .prepare(
          `INSERT INTO csp_quiz_submissions
             (id, userId, classroomId, sceneId, totalQuestions, correctCount, score, answersJson, submittedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(userId, classroomId, sceneId) DO UPDATE SET
             totalQuestions = excluded.totalQuestions,
             correctCount = excluded.correctCount,
             score = excluded.score,
             answersJson = excluded.answersJson,
             submittedAt = excluded.submittedAt`,
        )
        .run(
          id,
          params.userId,
          params.classroomId,
          params.sceneId,
          params.totalQuestions,
          params.correctCount,
          params.score,
          params.answersJson,
        )
      return cspQuizSubmission.findByUserScene(params.userId, params.classroomId, params.sceneId)
    },
    listByClassroom: (classroomId: string) => {
      return getDb()
        .prepare(
          'SELECT * FROM csp_quiz_submissions WHERE classroomId = ? ORDER BY submittedAt DESC',
        )
        .all(classroomId) as any[]
    },
  }
  systemConfig = {
    ...buildFinder('system_config', 'key'),
    findUnique: (args: any) => buildFinder('system_config', 'key').findUnique(args),
    // `system_config` is keyed by `key` (TEXT PRIMARY KEY) and has no `id`
    // column, unlike the other tables that the generic `buildFinder` was
    // written for. The shared upsert helper auto-injects a synthetic `id`
    // into the `create` payload, which then explodes with
    // `SqliteError: no such column: id` at INSERT time. Implement upsert
    // locally for this table so we only ever touch the real columns.
    upsert: ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const existing = getDb()
        .prepare(`SELECT key FROM system_config WHERE ${sqlCol} = ?`)
        .get(wval) as { key: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k} = ?`)
          params.push(v)
        }
        params.push(wval)
        getDb()
          .prepare(
            `UPDATE system_config SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`,
          )
          .run(...params)
      } else {
        const cols = Object.keys(create)
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => (create as Row)[c])
        getDb()
          .prepare(
            `INSERT INTO system_config (${cols.join(', ')}) VALUES (${placeholders})`,
          )
          .run(...values)
      }
      return { key: wval }
    },
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __studymateDb: PrismaCompatClient | undefined
}

// Hot-reload safety: when Next.js dev re-evaluates this module, the
// cached singleton (`globalThis.__studymateDb`) may pre-date the
// current class definition and therefore be missing fields that
// have been added since. Detect that case and re-instantiate so
// freshly-added properties (e.g. `parentInviteCode`) are actually
// present on the live object. This branch is dev-only — in
// production we keep the cache so multiple imports stay in sync.
let __cachedDb = globalThis.__studymateDb
if (
  process.env.NODE_ENV !== 'production' &&
  __cachedDb &&
  typeof (__cachedDb as unknown as { parentInviteCode?: unknown })
    .parentInviteCode === 'undefined'
) {
  __cachedDb = undefined
}
export const db: PrismaCompatClient = __cachedDb ?? new PrismaCompatClient()
if (process.env.NODE_ENV !== 'production') globalThis.__studymateDb = db
